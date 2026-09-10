/**
 * The instruction block Conduit writes into a project's own repository.
 *
 * Starting an agent appends a delimited section to `CLAUDE.md` or `AGENTS.md`
 * in the agent's working directory, telling that CLI where the shared content
 * and wiki live and who its teammates are. That file belongs to the user, not
 * to Conduit — so the markers live here, in one place, and deleting a project
 * takes the section back out again rather than leaving it behind forever.
 */
import fs from 'fs';
import path from 'path';

export const CONDUIT_MARKER = '<!-- Conduit -->';
export const CONDUIT_END_MARKER = '<!-- End Conduit -->';

/** Which file each CLI reads its project instructions from. */
export const INSTRUCTION_FILES: Record<string, string> = {
  claude: 'CLAUDE.md',
  codex: 'AGENTS.md',
  gemini: 'AGENTS.md',
  opencode: 'AGENTS.md',
  gpt: 'AGENTS.md',
  nemotron: 'AGENTS.md',
};

/** Every file name Conduit might have written into a project directory. */
export const ALL_INSTRUCTION_FILES = [...new Set(Object.values(INSTRUCTION_FILES))];

/**
 * Strip Conduit's section (and the older AgentOrg one) from a markdown file.
 * Returns the remaining text — the caller decides whether to write it back.
 */
export function stripConduitSection(text: string): string {
  return text
    .replace(/\n*<!-- AgentOrg[^>]*-->[\s\S]*?<!-- End AgentOrg -->\n*/g, '\n')
    .replace(/\n*<!-- Conduit[^>]*-->[\s\S]*?<!-- End Conduit -->\n*/g, '\n');
}

/**
 * Take Conduit's section back out of every instruction file in `cwd`.
 *
 * If nothing is left but the heading Conduit itself wrote, the file goes too —
 * it was ours. Anything the user wrote survives untouched. Best-effort by
 * design: a read-only file or a directory that no longer exists must not stop a
 * project from being deleted.
 *
 * Returns the paths that were changed.
 */
export function removeConduitSections(cwd: string, projectName?: string): string[] {
  const touched: string[] = [];
  for (const name of ALL_INSTRUCTION_FILES) {
    const file = path.join(cwd, name);
    try {
      if (!fs.existsSync(file)) continue;
      const before = fs.readFileSync(file, 'utf-8');
      if (!before.includes(CONDUIT_MARKER) && !before.includes('<!-- AgentOrg')) continue;
      const after = stripConduitSection(before).trim();

      // `# <project name>` on its own is the file Conduit created from nothing.
      const onlyOurHeading = projectName
        ? after === '' || after === `# ${projectName}`
        : after === '';
      if (onlyOurHeading) fs.unlinkSync(file);
      else fs.writeFileSync(file, after + '\n', 'utf-8');
      touched.push(file);
    } catch { /* best effort — never block a delete on the user's own repo */ }
  }
  return touched;
}
