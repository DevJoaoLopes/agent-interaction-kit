import assert from "node:assert/strict";

// This is a deliberately narrow grammar for our marked, plain-text <code> blocks,
// not a shell or a general HTML parser. Unexpected markup/commands fail closed.
export function snippet(html, id) {
  const blocks = [...html.matchAll(/<code\b([^>]*)>([\s\S]*?)<\/code>/g)].filter((match) =>
    match[1].includes(`data-doc-command="${id}"`),
  );
  assert.equal(blocks.length, 1, `Expected one snippet '${id}'`);
  return blocks[0][2]
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
      if (entity.startsWith("#"))
        return String.fromCodePoint(
          entity[1] === "x" ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1)),
        );
      return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[entity];
    })
    .trim();
}

function tokens(command) {
  const normalized = command.replace(/\\\r?\n/g, " ").trim();
  assert.match(normalized, /^[\w@./:\s-]+$/, `Unsupported command: ${command}`);
  return normalized.split(/\s+/);
}

function checkArgs(args) {
  assert.equal(args.length, 6, "Unsupported check arguments");
  assert.equal(args[0], "check", "Unsupported CLI command");
  assert.equal(args[1], "--provider", "Unsupported provider flag");
  assert.equal(args[3], "--consumer", "Unsupported consumer flag");
  assert.equal(args[5], "--strict", "Documented checks must use --strict");
  for (const file of [args[2], args[4]]) {
    assert.match(file, /^[a-zA-Z0-9][\w.-]*\.json$/, `Unsupported manifest path: ${file}`);
  }
  return args;
}

function install(command, version) {
  const args = tokens(command);
  assert.deepEqual(
    args.slice(0, 4),
    ["npm", "install", "--save-dev", "--save-exact"],
    "Unsupported install command",
  );
  assert.equal(args.length, 5, "Unsupported install arguments");
  assert.equal(
    args[4],
    `@agent-interaction-kit/core@${version}`,
    "Snippet version/package mismatch",
  );
}

function check(command, prefix) {
  const args = tokens(command);
  assert.deepEqual(args.slice(0, prefix.length), prefix, "Unsupported command prefix or package");
  return checkArgs(args.slice(prefix.length));
}

export function parseSnippets(docs, version) {
  const commands = [];
  install(snippet(docs, "quickstart-install"), version);
  commands.push({
    page: "/docs/",
    id: "quickstart-check",
    args: check(snippet(docs, "quickstart-check"), ["npx", "--no-install", "aik"]),
  });
  install(snippet(docs, "docs-install"), version);
  commands.push({
    page: "/docs/",
    id: "docs-check",
    args: check(snippet(docs, "docs-check"), ["npx", "--no-install", "aik"]),
  });
  commands.push({
    page: "/docs/",
    id: "docs-dlx",
    args: check(snippet(docs, "docs-dlx"), [
      "pnpm",
      "dlx",
      `@agent-interaction-kit/core@${version}`,
    ]),
  });
  const script = JSON.parse(snippet(docs, "docs-script"));
  assert.deepEqual(Object.keys(script), ["scripts"], "Unsupported package snippet");
  assert.deepEqual(Object.keys(script.scripts), ["test:contracts"], "Unsupported npm script");
  commands.push({
    page: "/docs/",
    id: "docs-script",
    args: check(script.scripts["test:contracts"], ["aik"]),
  });
  const ci = snippet(docs, "docs-ci");
  assert.match(
    ci,
    /^- name: [\w ]+\n\s+run: npm ci\n\s*\n- name: [\w ]+\n\s+run: npm run test:contracts$/,
    "Unsupported CI snippet",
  );
  return commands;
}
