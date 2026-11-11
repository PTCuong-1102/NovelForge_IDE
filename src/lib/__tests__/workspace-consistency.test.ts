import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Workspace consistency guard tests', () => {
  const rootDir = process.cwd();
  const read = (rel: string) =>
    fs.readFileSync(path.join(rootDir, rel), 'utf8');

  it('1. The TipTap highlighter uses the shared Unicode word boundary', () => {
    const highlighter = read(
      'src/components/editor/extensions/entity-highlighter.ts'
    );
    assert(
      highlighter.includes('findWholeWordOccurrences'),
      'the TipTap highlighter must use findWholeWordOccurrences'
    );
    assert(
      !highlighter.includes('isWordBoundaryChar'),
      'the manual ASCII boundary check must be gone'
    );
    assert(
      !highlighter.includes('tokenLower'),
      'the lowercased token map is no longer needed'
    );
  });

  it('2. The raw Markdown view maps every standard frontmatter field back', () => {
    const editor = read('src/components/editor/NovelEditor.tsx');
    for (const key of [
      'title',
      'act_id',
      'act_title',
      'order',
      'status',
      'pov_character_id',
      'pov_character_name',
      'story_date',
      'story_year',
      'location_id',
      'location_tag',
      'target_words',
      'is_flashback',
    ]) {
      assert(
        editor.includes(`text('${key}')`) ||
          editor.includes(`numeric('${key}')`) ||
          editor.includes(`fm.${key}`),
        `the raw Markdown view must map the ${key} field back`
      );
    }
    assert(
      editor.includes('metadataPatch.extra_frontmatter'),
      'the custom keys must be mapped back too'
    );
    assert(
      editor.includes('metadataPatch.frontmatter_keys_order'),
      'the key order must be mapped back too'
    );
  });

  it('3. "Xem xuất hiện" opens the search view', () => {
    const page = read('src/app/page.tsx');
    assert(
      page.includes('findUsagesEntityId'),
      'the workbench must react to a find-usages request'
    );
    assert(
      page.includes("setActiveActivity('search')"),
      'the search view must be opened'
    );

    const sidebar = read('src/components/workbench/Sidebar.tsx');
    assert(
      sidebar.includes('findUsagesEntityId'),
      'the sidebar must react to a find-usages request'
    );
    assert(
      sidebar.includes('setSearchQuery(entity.title)'),
      'the search box must be pre-filled with the entity name'
    );
  });

  it('4. The snapshot delta is signed by its value', () => {
    const sidebar = read('src/components/workbench/Sidebar.tsx');
    assert(
      sidebar.includes("snap.word_count_delta >= 0 ? '+' : ''"),
      'the delta sign must follow the value'
    );
  });

  it('5. The inline diff card reacts to Tab and Esc', () => {
    const editor = read('src/components/editor/NovelEditor.tsx');
    assert(
      editor.includes('pendingDiff'),
      'the key handler must know about a pending diff'
    );
    assert(
      editor.includes("pendingDiff.id, 'accepted'"),
      'Tab must accept the pending diff'
    );
    assert(
      editor.includes("pendingDiff.id, 'rejected'"),
      'Esc must reject the pending diff'
    );
  });

  it('6. The chapter and entity sheets expose a dedicated id change', () => {
    const header = read(
      'src/components/editor/ChapterHeaderProperties.tsx'
    );
    assert(
      header.includes('updateChapterMetadata(chapter.id, { id: next })'),
      'the chapter id must be changeable'
    );
    assert(header.includes('Đổi ID'), 'the chapter id field must be visible');

    const sheet = read('src/components/lorebook/CharacterSheet.tsx');
    assert(
      sheet.includes('updateEntity(entity.id, { id: next })'),
      'the entity id must be changeable'
    );
    assert(sheet.includes('Đổi ID'), 'the entity id field must be visible');
  });

  it('7. The raw Markdown view never rewrites the chapter id', () => {
    const editor = read('src/components/editor/NovelEditor.tsx');
    assert(
      !editor.includes('metadataPatch.id ='),
      'the id changes through the dedicated field, not through the raw view'
    );
  });
});
