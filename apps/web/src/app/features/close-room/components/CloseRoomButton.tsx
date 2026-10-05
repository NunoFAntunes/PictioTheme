import { sendToRoom, useRoomStore } from '../../../realtime';
import { ConfirmNote } from '../../../ui/ConfirmNote';
import { PaperBall } from '../../../ui/PaperBall';
import { STICKER_BUTTON } from '../../../ui/room-frame';
import { crumpleRoom } from '../crumple-store';

/** The host's "Close room": asks on a note, then the room is crumpled up and kicked away. */
export function CloseRoomButton() {
  const open = useRoomStore((s) => s.connection.kind === 'open');
  return (
    <ConfirmNote
      label={
        <>
          <PaperBall className="size-5" />
          Close room
        </>
      }
      className={`${STICKER_BUTTON} hover:bg-pop-tomato`}
      title="Close the room?"
      cancelLabel="Keep it open"
      confirmLabel={
        <>
          <PaperBall className="size-5" />
          Crumple it up
        </>
      }
      // Without a connection the room wouldn't close: the ball would fly but the room stay open.
      confirmDisabled={!open}
      onConfirm={() => {
        sendToRoom({ t: 'room:close' });
        crumpleRoom();
      }}
    >
      Everyone's sent home, and nobody can get back in.
    </ConfirmNote>
  );
}
