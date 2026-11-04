<div align="center">

# 🖋️ NovelForge IDE

### *The Compiler-Grade Desktop IDE for Novelists, Screenwriters & World-Builders*

[![Next.js 15](https://img.shields.io/badge/Next.js-15.0-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2.0-24C8D8?style=for-the-badge&logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.75+-DEA584?style=for-the-badge&logo=rust&logoColor=black)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)

<p align="center">
  <b>NovelForge IDE</b> bridges the gap between literary craftsmanship and modern software engineering ergonomics.<br/>
  Featuring real-time narrative continuity linting, cross-chapter safe symbol refactoring, dynamic character relationship graphs, Notion-style lorebook databases, narrative Git snapshots, and multi-agent AI collaboration.
</p>

[Key Features](#-key-features) •
[Architecture](#-system-architecture) •
[Quick Start](#-quick-start) •
[Keyboard Shortcuts](#-ergonomic-shortcuts) •
[Publishing Pipeline](#-publishing-compiler) •
[Contributing](#-contributing)

</div>

---

## 📖 Why NovelForge IDE?

Traditional word processors (**Microsoft Word, Google Docs, Scrivener**) were built for static typography and unstructured prose. They fail when authors face modern complexity:
* ❌ **Plot Holes & Dead Entity Inconsistencies:** A character killed in Chapter 5 accidentally reappears in Chapter 8 without warning.
* ❌ **Destructive Renaming:** Changing a protagonist's name or title breaks nicknames, aliases, and mentions across dozens of chapters.
* ❌ **Disjointed World-Building:** Lore lives in separate wikis or notes disconnected from the actual manuscript editor.
* ❌ **Fear of Plot Experimentation:** Branching out an alternative plotline risks breaking the original manuscript without version control.

**NovelForge IDE treats your novel like a high-performance codebase.** It parses manuscripts into semantic Abstract Syntax Trees (AST), runs real-time static analysis for narrative continuity, models lore as relational databases, and visualizes entity dynamics across chronological timelines.

---

## ⚡ Key Features

### 1. 🛡️ Continuity Linter & Semantic Quick Fixes
* **Compiler-Grade Static Analysis:** Runs background rule checking over all chapters and lore entries.
  * **Rule 1 (Dead Entity Logic):** Flags errors when a deceased or incapacitated character appears in subsequent chapters without a flashback tag.
  * **Rule 2 (Chronology & POV Conflicts):** Verifies chapter frontmatter timestamps and flags impossible travel or simultaneous presence.
  * **Rule 3 (Pacing & Style Repetition):** Detects clustered repetition of sensory adjectives or overused tropes within individual scenes.
* **Inline Squiggly Underlines & Popovers:** Click any warning/error or press `Alt+Enter` to apply **Quick Fixes** (e.g., automatically tag paragraph as `[Flashback]`, update character status, or ignore rule).

### 2. 🔀 Smart Literary Refactoring (`Shift+F6`)
* **Whole-Word & Alias-Aware Renaming:** Safe, project-wide renaming that distinguishes between exact matches, substrings, and contextual aliases (e.g., renaming *"Lâm Vũ Linh"* automatically updates *"Tiểu Linh"* and *"Agent #7"*).
* **Cross-Chapter Sentence Previews:** Displays an interactive diff list across all chapters, allowing you to selectively uncheck specific instances before applying changes.

### 3. 🧬 Notion-Style Lorebook Database & Implicit Entity Linking
* **Structured World-Building Schema:** Manage characters, factions, locations, artifacts, and historical events.
* **Table & Gallery Views:** Filter by category, status (*Alive / Deceased*), faction, or custom attributes.
* **Implicit Linking:** Automatically detects lore mentions in prose without requiring manual `@` tagging, displaying rich hover cards with backlink counts and character stats.

### 4. 🕸️ Interactive Character Relationship Graph (`@xyflow/react`)
* **Live Dynamic Graph:** Visual node-and-edge graph rendered using high-performance React Flow.
* **Time-Scrubber Slider:** Drag the chapter timeline slider to watch alliances, rivalries, and mentorship ties morph and invert across the story's progression.

### 5. 📜 Story Timeline Snapshots & What-If Branching
* **Narrative Version Control:** Create zero-overhead Git snapshots of your manuscript and world state (`Ctrl+S`).
* **What-If Exploration:** Branch out alternate plotlines (e.g., *"branch: protag-joins-villain"*) and test narrative arcs without risking your master manuscript.
* **One-Click Restore:** Compare diffs and roll back to any historical milestone instantly.

### 6. 📦 Publishing Compiler Pipeline (`Ctrl+E`)
* **Multi-Format Static Generation:** Compiles entire manuscripts into publication-ready formats:
  * 📕 **EPUB 3 / HTML Reader:** Clean semantic markup with embedded chapter navigation.
  * 📄 **DOCX / Standard Manuscript Format:** Formatted for literary agents and editorial submissions (double-spaced, standard margins).
  * 📑 **PDF Print View:** Formatted with serif typography, page breaks, and chapter headers.
* **Sanitization Engine:** Automatically strips private author comments (`> [!GHI_CHÚ_TÁC_GIẢ]`) and optionally compiles a dynamic **Glossary / Lore Index** appendix.

### 7. 🤖 Multi-Agent AI Bridge (MCP)
* **Model Context Protocol (MCP) Integration:** Connects seamlessly to external autonomous agents (**Cline, Antigravity, OpenCode**).
* **Inline Proposal Cards:** Agents propose rewrite diffs directly on target paragraphs with detailed literary rationales. Accept (`Enter`) or Reject (`Esc`) with a single keystroke.

### 8. 🎨 Typographic Ergonomics & Zen Focus Mode
* **Three Curated Themes:**
  * 🌑 **Obsidian Dark:** High-contrast, OLED-friendly dark palette for late-night writing.
  * 📜 **Parchment Sepia:** Warm, soothing paper tones optimized for long editing sessions.
  * ☀️ **Daylight Light:** Crisp editorial paper finish with clean serifs.
* **Distraction-Free Zen Mode (`Ctrl+Shift+Z`):** Hides all chrome, toolbars, sidebars, and docks, focusing 100% of your display on the paragraph at hand.
* **Typewriter Scrolling & Paragraph Focus:** Keeps the active writing line centered while subtly dimming surrounding paragraphs.

---

## 🏛️ System Architecture

NovelForge IDE is engineered as an **offline-first hybrid monorepo**:

```
NovelForge_IDE/
├── src/                               # Frontend Presentation & Application Layer
│   ├── app/                           # Next.js 15 App Router (Static Export)
│   │   ├── layout.tsx                 # Root layout & theme synchronizer
│   │   ├── page.tsx                   # Main IDE Workbench container
│   │   └── globals.css                # CSS variables for themes (Obsidian/Parchment/Daylight)
│   ├── components/
│   │   ├── editor/                    # NovelEditor, TipTap integration, SlashMenu, Frontmatter
│   │   ├── lorebook/                  # LoreDatabaseView, CharacterSheet, RelationshipGraph
│   │   ├── workbench/                 # ActivityBar, Sidebar, DockLayout, TabBar, StatusBar
│   │   ├── ai-hub/                    # RightDock, MCP agent diffs & prompt composer
│   │   └── modals/                    # CommandPalette, RefactorRenameModal, PublishModal
│   ├── stores/                        # Zustand reactive state stores
│   │   ├── useWorkspaceStore.ts       # Chapters, Lore entities, Snapshots, Tab manager
│   │   ├── useEditorStore.ts          # Typography, font sizing, active cursor, focus modes
│   │   └── useAgentStore.ts           # MCP bridge, pending diff proposals, agent chat
│   └── lib/
│       ├── tauri-bridge.ts            # High-performance IPC bridge (Rust Tauri ↔ Browser)
│       └── __tests__/                 # Core engine unit test suite (Vitest/Node test runner)
│
├── src-tauri/                         # Rust Core Desktop Engine (Tauri v2)
│   ├── src/
│   │   ├── core_engine/               # AST Parser, Continuity Linter, Refactor engine
│   │   ├── ai_bridge/                 # MCP Server, RAG embeddings & vector indexing
│   │   ├── vcs/                       # Git snapshot engine, diff calculator
│   │   └── commands/                  # IPC Command handlers exposed to frontend
│   ├── Cargo.toml                     # Rust dependencies (tauri, serde, rusqlite, walkdir)
│   └── tauri.conf.json                # Desktop application windowing & security capabilities
│
├── manuscript/                        # User's structured markdown chapters
│   └── act-01/                        # Organized by acts, arcs, and chapters
└── lorebook/                          # Relational markdown files for characters, items, locations
```

### Data Flow Diagram

```mermaid
flowchart TD
    subgraph Frontend["Frontend Client (Next.js 15 + TipTap + Zustand)"]
        UI["IDE Workbench & Multi-Tab Panes"]
        TipTap["TipTap Rich Editor + Decorated AST"]
        Store["Zustand Workspace & Editor Stores"]
        LinterUI["Continuity Linter & Quick Fix Popover"]
    end

    subgraph IPC["IPC Bridge Layer"]
        Bridge["tauri-bridge.ts (Offline Fallback & Native IPC)"]
    end

    subgraph RustCore["Native Rust Core Engine (Tauri v2)"]
        AST["Markdown & YAML Frontmatter Parser"]
        LinterEngine["Static Analysis & Timeline Validation"]
        VCS["Git Snapshots & Branching Engine"]
        MCPServer["MCP Bridge (Cline / Antigravity / OpenCode)"]
        SQLite["SQLite + sqlite-vec Local Database"]
    end

    UI --> Store
    TipTap <--> Store
    Store --> LinterUI
    Store <--> Bridge
    Bridge <--> RustCore
    RustCore --> AST
    AST --> LinterEngine
    RustCore --> VCS
    RustCore --> MCPServer
    RustCore --> SQLite
```

---

## 🚀 Quick Start

### Prerequisites
* **Node.js:** v18.17.0+ (LTS recommended)
* **npm:** v9.0.0+
* *(Optional for native desktop app)*: **Rust** v1.75+ (`rustup default stable`)

### 1. Clone the Repository
```bash
git clone https://github.com/PTCuong-1102/NovelForge_IDE.git
cd NovelForge_IDE
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Web Application
```bash
# Start development server with live reload
npm run dev

# Open in browser: http://localhost:3000
```

### 4. Build Production Static Bundle
```bash
npm run build

# Preview static export
npx serve out -p 3456
# Open in browser: http://localhost:3456
```

### 5. Run Native Desktop App (Tauri v2)
```bash
# Development mode with native desktop window
npm run tauri dev

# Production standalone executable build
npm run tauri build
```

> **Note for Linux users:** Ensure native GTK & WebKit libraries are installed:
> ```bash
> # Fedora / RHEL
> sudo dnf install -y gcc webkit2gtk4.1-devel openssl-devel libappindicator-gtk3-devel librsvg2-devel
> 
> # Ubuntu / Debian
> sudo apt install -y build-essential libwebkit2gtk-4.1-dev libssl-dev libappindicator3-dev librsvg2-dev
> ```

---

## ⌨️ Ergonomic Shortcuts

NovelForge IDE is designed for lightning-fast keyboard-driven navigation, mirroring VS Code and JetBrains ergonomics:

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>P</kbd> | **Quick Open** | Search and jump to any chapter or lore dossier instantly |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> | **Command Palette** | Execute any IDE command or formatting setting |
| <kbd>Shift</kbd> + <kbd>F6</kbd> | **Smart Refactor Rename** | Project-wide safe character/entity rename with preview |
| <kbd>Alt</kbd> + <kbd>Enter</kbd> | **Linter Quick Fix** | Open remediation actions for continuity errors |
| <kbd>Ctrl</kbd> + <kbd>\\</kbd> | **Split Editor** | Toggle dual-pane side-by-side editing mode |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | **Zen Focus Mode** | Toggle 100% distraction-free full-screen writing |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | **Save & Snapshot** | Save manuscript and create a narrative Git snapshot |
| <kbd>Ctrl</kbd> + <kbd>E</kbd> | **Publishing Compiler** | Open export dialog for EPUB, DOCX, and PDF |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>E</kbd> | **Manuscript Explorer** | Focus chapters file tree in left sidebar |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> | **Lorebook Database** | Focus world-building entries in left sidebar |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd> | **Continuity Inspector** | Inspect all project plot holes and stylistic warnings |

---

## 🧪 Testing & Verification

NovelForge includes a comprehensive unit test suite covering the entire core literature engine:

```bash
npm test
```

### Test Coverage Highlights
* `✔` **YAML Frontmatter Parser:** Lossless AST serialization and frontmatter parsing.
* `✔` **Vietnamese & Latin Word Counter:** Accurate word counts respecting diacritics and word boundaries.
* `✔` **Implicit Mention Scanner:** Scans multi-word aliases and entity titles without manual `@` markers.
* `✔` **Continuity Linter (Rule 1):** Accurately flags dead characters appearing in subsequent timestamps.
* `✔` **Continuity Linter (Rule 3):** Accurately detects phrase repetitions within close proximity.
* `✔` **Smart Refactoring Previews:** Generates contextual before/after sentence previews without false-positive substring matches.

---

## 🗺️ Product Roadmap

- [x] Next.js 15 + Tauri v2 Monorepo Core
- [x] TipTap Semantic Editor with YAML Frontmatter Integration
- [x] Continuity Linter Engine (Dead character detection, timeline chronology, style repetition)
- [x] Notion-Style Lorebook Relational Database & Implicit Auto-Linking
- [x] `@xyflow/react` Interactive Character Relationship Graph with Timeline Scrubber
- [x] Cross-Chapter Smart Literary Refactoring (`Shift+F6`)
- [x] Multi-Format Publishing Compiler (EPUB 3, DOCX, PDF)
- [x] Git Story Snapshots & Narrative Branching
- [x] Multi-Agent AI Diff Review System (MCP Integration)
- [ ] Local Offline LLM Integration via `llama.cpp` / Ollama
- [ ] Vector Embedding Semantic Search (`sqlite-vec`) for cross-novel lore search
- [ ] Collaborative Peer-to-Peer Story Review via CRDTs (Yjs)

---

## 🤝 Contributing

Contributions to NovelForge IDE are welcome! Whether you are a writer suggesting workflow improvements or an engineer contributing features:

1. Fork the Project (`https://github.com/PTCuong-1102/NovelForge_IDE/fork`)
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: add some amazing feature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<div align="center">
  <sub>Crafted with passion for writers and engineers worldwide by <a href="https://github.com/PTCuong-1102">PTCuong</a>.</sub>
</div>
