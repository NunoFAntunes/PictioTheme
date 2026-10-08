import { expect, test, type Page } from '@playwright/test';
import { DRAWER, followInvite, hostRoom, newPlayerPage } from './support';

/**
 * Guessing out loud. Browsers in tests have no speech recogniser that hears anything, so the
 * guest gets a stand-in. `__recognition.hear(text)` is the recogniser's first, not-yet-final take
 * on a new phrase; it only turns final when listening stops. Opening the mic hears `__say`.
 */
function fakeRecogniser() {
  type Handler = ((e: unknown) => void) | null;
  const w = window as unknown as { __say?: string } & Record<string, unknown>;
  const Fake = class {
    lang = '';
    onresult: Handler = null;
    onerror: Handler = null;
    onend: (() => void) | null = null;
    results: { transcript: string; isFinal: boolean }[] = [];
    start() {
      w.__recognition = this;
      w.__lang = this.lang;
      const say = w.__say;
      if (say) setTimeout(() => this.hear(say), 50);
    }
    hear(transcript: string) {
      this.results.push({ transcript, isFinal: false });
      this.emit();
    }
    stop() {
      const last = this.results.at(-1);
      if (last && !last.isFinal) {
        last.isFinal = true;
        this.emit();
      }
      setTimeout(() => this.onend?.());
    }
    abort() {
      this.onerror?.({ error: 'aborted' });
      setTimeout(() => this.onend?.());
    }
    emit() {
      this.onresult?.({
        resultIndex: this.results.length - 1,
        results: this.results.map(({ transcript, isFinal }) =>
          Object.assign([{ transcript, confidence: 1 }], { isFinal }),
        ),
      });
    }
  };
  w.SpeechRecognition = Fake;
  w.webkitSpeechRecognition = Fake;
}

function hear(page: Page, text: string) {
  return page.evaluate(
    (t) =>
      (window as unknown as { __recognition: { hear(t: string): void } }).__recognition.hear(t),
    text,
  );
}

test('a guesser holds the mic to say a guess, then leaves it open and says guess after guess', async ({
  browser,
}) => {
  const host = await newPlayerPage(browser, DRAWER);
  const guest = await newPlayerPage(browser);
  await guest.addInitScript(fakeRecogniser);

  const code = await hostRoom(host, 'Ana');
  await followInvite(guest, code, 'Bo');
  await host.getByRole('button', { name: /start game/i }).click();
  await host.getByText('Choose what to draw').waitFor();
  await host
    .getByRole('button', { name: /×1|silly/i })
    .first()
    .click();
  const word =
    (await host.getByTestId('current-word').textContent())?.replace('✏️', '').trim() ?? '';
  expect(word.length).toBeGreaterThan(0);

  // The drawer has nothing to say: no mic.
  await expect(host.getByRole('button', { name: 'Say it out loud' })).toHaveCount(0);

  // Hold to talk: what it hears shows in a bubble, and letting go sends it, once, without
  // waiting for the recogniser's final word on it.
  const mic = guest.getByRole('button', { name: 'Say it out loud' });
  await guest.evaluate(
    () => ((window as unknown as { __say: string }).__say = 'big purple cactus'),
  );
  await mic.hover();
  await guest.mouse.down();
  await expect(guest.getByRole('status')).toHaveText('“big purple cactus”');
  await guest.waitForTimeout(300); // a press this long is a hold (HOLD_MS), not a tap
  await guest.mouse.up();
  await expect(host.getByRole('log').getByText('big purple cactus')).toHaveCount(1);
  await expect(guest.getByRole('status')).toHaveCount(0);
  expect(await guest.evaluate(() => (window as unknown as { __lang: string }).__lang)).toBe(
    'en-GB',
  );

  // Tap: the mic stays open, and each phrase goes out as soon as it settles, before the
  // recogniser has decided it's final.
  await guest.evaluate(() => ((window as unknown as { __say: string }).__say = ''));
  await mic.click();
  await expect(guest.getByRole('button', { name: 'Stop listening' })).toBeVisible();
  await hear(guest, 'a wonky teapot');
  await expect(host.getByRole('log').getByText('a wonky teapot')).toBeVisible();
  await expect(guest.getByRole('status')).toContainText('“a wonky teapot” sent');
  await hear(guest, word);
  await expect(guest.getByRole('log').getByText('You got it!')).toBeVisible();
  // Solving closes the mic.
  await expect(guest.getByRole('button', { name: 'Say it out loud' })).toBeVisible();
});
