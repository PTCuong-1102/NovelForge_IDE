import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('UI Theme Contrast & Typography Guard Tests', () => {
  const rootDir = process.cwd();

  it('1. Defines adaptive semantic color variables for all 3 themes in globals.css', () => {
    const css = fs.readFileSync(path.join(rootDir, 'src/app/globals.css'), 'utf8');
    assert(css.includes('--bg-paper:'), 'Must define --bg-paper');
    assert(css.includes('--semantic-error-text:'), 'Must define --semantic-error-text');
    assert(css.includes('--semantic-warning-text:'), 'Must define --semantic-warning-text');
    assert(css.includes('--semantic-success-text:'), 'Must define --semantic-success-text');
    assert(css.includes('--semantic-info-text:'), 'Must define --semantic-info-text');
    assert(css.includes('--entity-pill-text:'), 'Must define --entity-pill-text');
    assert(css.includes('--lore-pill-text:'), 'Must define --lore-pill-text');
  });

  it('2. Loads Vietnamese Google Fonts (Literata, Plus Jakarta Sans, JetBrains Mono) in layout.tsx', () => {
    const layout = fs.readFileSync(path.join(rootDir, 'src/app/layout.tsx'), 'utf8');
    assert(layout.includes('Literata'), 'Must load Literata font');
    assert(layout.includes('Plus+Jakarta+Sans'), 'Must load Plus Jakarta Sans font');
    assert(layout.includes('JetBrains+Mono'), 'Must load JetBrains Mono font');
  });

  it('3. NovelEditor uses seamless in-place editing and adaptive semantic styles', () => {
    const editorCode = fs.readFileSync(
      path.join(rootDir, 'src/components/editor/NovelEditor.tsx'),
      'utf8'
    );
    assert(
      !editorCode.includes('group-hover:opacity-60'),
      'Must remove permanent hover-revealed secondary raw textarea'
    );
    assert(
      !editorCode.includes('text-red-300') &&
        !editorCode.includes('text-emerald-300') &&
        !editorCode.includes('text-blue-300'),
      'Must not use hardcoded pale dark-only text classes in NovelEditor'
    );
    assert(
      editorCode.includes('editingParagraphIndex'),
      'Must support in-place paragraph editing state'
    );
  });

  it('4. Ensures zero hardcoded low-contrast pale text classes exist across all components', () => {
    const forbiddenClasses = [
      'text-red-200',
      'text-red-300',
      'text-amber-200',
      'text-emerald-200',
      'text-emerald-300',
      'text-blue-300',
      'bg-emerald-950/20',
      'bg-red-950/20',
    ];
    const filesToCheck = [
      'src/components/workbench/Sidebar.tsx',
      'src/components/ai-hub/RightDock.tsx',
      'src/components/editor/NovelEditor.tsx',
      'src/components/lorebook/RelationshipGraph.tsx',
      'src/components/modals/RefactorRenameModal.tsx',
    ];
    for (const relPath of filesToCheck) {
      const content = fs.readFileSync(path.join(rootDir, relPath), 'utf8');
      for (const badClass of forbiddenClasses) {
        assert(
          !content.includes(badClass),
          `File ${relPath} must not contain low-contrast class "${badClass}"`
        );
      }
    }
  });

  it('5. Guards DockLayout and TabBar against undefined secondary tabs in split view', () => {
    const dockCode = fs.readFileSync(
      path.join(rootDir, 'src/components/workbench/DockLayout.tsx'),
      'utf8'
    );
    const tabBarCode = fs.readFileSync(
      path.join(rootDir, 'src/components/workbench/TabBar.tsx'),
      'utf8'
    );
    assert(
      !dockCode.includes(': [activeSecondaryTab]'),
      'DockLayout must not wrap potentially undefined activeSecondaryTab in an array without filtering'
    );
    assert(
      tabBarCode.includes('tabs.filter(Boolean)'),
      'TabBar must defensively filter out falsy/undefined tab entries before mapping'
    );
  });
});
