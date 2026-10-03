// Import boundaries from docs/technical/backend-guidelines.md and frontend-guidelines.md.
// Run with `pnpm deps:check`. Each rule names the guideline it enforces.

const SERVER = '^apps/server/src';
const WEB_APP = '^apps/web/src/app';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ── Everywhere ──
    {
      name: 'no-circular',
      comment: 'B2: no import cycles.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'packages-do-not-import-apps',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'server-and-web-are-separate',
      severity: 'error',
      from: { path: '^apps/(server|web)/' },
      to: { path: '^apps/', pathNot: '^apps/$1/' },
    },

    // ── Shared packages ──
    {
      name: 'game-core-has-no-io',
      comment: 'B6: game-core imports no Node built-ins.',
      severity: 'error',
      from: { path: '^packages/game-core/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'game-core-allowed-dependencies',
      comment: 'B6: game-core may only use protocol and small pure libraries.',
      severity: 'error',
      from: { path: '^packages/game-core/' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'local'],
        pathNot: ['^packages/(game-core|protocol)/', 'node_modules/(pluralize|vitest)/'],
      },
    },
    {
      name: 'protocol-is-schemas-only',
      comment: 'B7: protocol depends on zod only.',
      severity: 'error',
      from: { path: '^packages/protocol/' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'core', 'local'],
        pathNot: ['^packages/protocol/', 'node_modules/(zod|vitest)/'],
      },
    },

    // ── Server ──
    {
      name: 'server-module-boundaries',
      comment: "B1: modules import each other only through the other module's index.ts.",
      severity: 'error',
      from: { path: `${SERVER}/modules/([^/]+)/` },
      to: {
        path: `${SERVER}/modules/`,
        pathNot: [`${SERVER}/modules/$1/`, `${SERVER}/modules/[^/]+/index\\.ts$`],
      },
    },
    {
      name: 'server-routes-and-jobs-do-not-touch-db',
      comment: 'B3: routes and jobs call services, never the database.',
      severity: 'error',
      from: { path: '\\.(routes|jobs)\\.ts$' },
      to: { path: `${SERVER}/db/` },
    },
    {
      name: 'server-repositories-do-not-import-services',
      comment: 'B3: layers point downward.',
      severity: 'error',
      from: { path: '\\.repository\\.ts$' },
      to: { path: '\\.(service|routes|jobs)\\.ts$' },
    },
    {
      name: 'server-services-do-not-import-fastify',
      comment: 'B4: services are framework-agnostic.',
      severity: 'error',
      from: { path: '\\.service\\.ts$' },
      to: { path: 'node_modules/(fastify|@fastify/|fastify-)' },
    },
    {
      name: 'server-lib-is-a-leaf',
      comment: 'lib/ holds generic helpers without domain knowledge.',
      severity: 'error',
      from: { path: `${SERVER}/lib/` },
      to: { path: `${SERVER}/(modules|plugins|db|infra)/` },
    },

    // ── Web ──
    {
      name: 'web-feature-boundaries',
      comment: "W1: features import each other only through the other feature's index.ts.",
      severity: 'error',
      from: { path: `${WEB_APP}/features/([^/]+)/` },
      to: {
        path: `${WEB_APP}/features/`,
        pathNot: [`${WEB_APP}/features/$1/`, `${WEB_APP}/features/[^/]+/index\\.ts$`],
      },
    },
    {
      name: 'web-routes-use-feature-index',
      comment: "W1: routes use a feature's public index.ts.",
      severity: 'error',
      from: { path: `${WEB_APP}/routes/` },
      to: {
        path: `${WEB_APP}/features/[^/]+/.+`,
        pathNot: `${WEB_APP}/features/[^/]+/index\\.ts$`,
      },
    },
    {
      name: 'web-ui-and-lib-are-leaves',
      comment: 'W1: ui/ and lib/ import nothing from features or routes.',
      severity: 'error',
      from: { path: `${WEB_APP}/(ui|lib)/` },
      to: { path: `${WEB_APP}/(features|routes)/` },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['/dist/', '/\\.astro/', '\\.test\\.tsx?$', '/test-support/'] },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.d.ts'],
    },
  },
};
