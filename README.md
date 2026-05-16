# Kno — The Knowledge Internalization Engine 🧠

<p align="center">
  <img src="public/kno.png" alt="Kno Logo" width="200" />
</p>

<p align="center">
  <strong>"Read less, internalize more."</strong>
</p>

---

Kno is a minimalist, AI-powered interactive workspace designed not just to store information, but to help you actually master it. Unlike traditional "second brain" tools that frequently turn into digital graveyards, Kno treats knowledge as a living network. By combining spatial mapping whiteboards, deep AI synthesis, and automated spaced repetition, Kno ensures that the information you capture truly stays with you.

Kno is available as a web platform with auto-save and cross-device sync, with native desktop/mobile apps currently in development for direct download via our website or GitHub.

---

## 🎨 The Philosophy

Most productivity tools focus strictly on *capture*. Kno focuses on **internalization**. It moves your data dynamically through three key operational stages:
1. **Capture:** Seamless ingestion of URLs, YouTube videos, PDFs, and raw text files.
2. **Distill:** AI-driven synthesis into "Smart Cards," clean summaries, and "Reasoning Traces."
3. **Internalize:** Dynamic multiple-choice quizzes, spatial canvas mapping, and logic validation to challenge your understanding.

---

## ✨ Core Features & Modules

### 📥 1. Ingestion & Storage Workspace

* **Inbox:** Your low-friction entry point. Drop files or paste links here to automatically trigger instant source summaries and baseline multiple-choice quizzes.
* **Library:** Your curated collection, organized into three dedicated tabs:
    * *Sources:* Individual raw and synthesized assets.
    * *Folders & Themes:* Fully customizable structural hubs where you can assign custom names and aesthetic colors to your boards.
* **The Brain:** The central relational hub of your knowledge graph. Every source node stores its full contextual history: adaptive quizzes, quiz performance history, automated summaries, your personal thoughts, and any supplementary files attached to that node.

### 🎨 2. Learning Canvas & Visual Spatialization

* **Interactive Whiteboard:** A high-performance canvas to visually map your knowledge graph. Drag, drop, and link sources directly into folders or themes using responsive edge connections.
* **Arrange:** AI-driven layout management featuring two core actions:
    1.  *Tidy Board:* Automatically clean up messy node placements on the canvas.
    2.  *Tidy Themes:* Auto-cluster loose canvas sources into their relevant themes and sync them back to your Library.
* **Whiteboard Export:** Seamlessly download your entire workspace visual mapping into clean **Markdown** or **PDF** documentation.

### 🧪 3. Memory Lab & Retention

* **Memory Integration:** Universally synced with **The Brain**. It tracks continuous quiz performance, compiles overall mastery scores, and logs exact historic dates of when content was uploaded or generated.
* **Spaced Repetition Trigger:** The system calculates knowledge decay, dynamically serving alerts showing exactly which source quizzes you need to redo to prevent memory fade.

### ⚡ 4. Advanced AI Generation & Reasoning Labs

* **Neural Dump:** The housekeeper of your whiteboard. Offload raw, unstructured text thoughts, or select multiple sources on the canvas to auto-generate custom learning paths and original AI images.
* **Collider:** Select two or more conflicting sources to have them debate their differing opinions and extract constructive friction.
* **Alchemy:** Transmute multiple distinct sources to forge brand-new conceptual perspectives and syntheses.
* **Spark:** The intellectual matchmaker. Select a source and let AI scan your network to connect it to unexpected but highly relevant auxiliary ideas.
* **Logic Guide:** Run deep analytical scans on incoming sources to evaluate content validity. It grades your sources across three axes:
    * *Factual Accuracy*
    * *Cognitive Balance*
    * *Logical Integrity*
* **Ko (AI Workspace Assistant):** Your dedicated whiteboard secretary. Converse directly with single or multiple documents simultaneously; all contextual chat histories save automatically alongside those specific sources.

---

## 🎭 Aesthetic Themes

Design that respects your focus. Personalize your canvas and dashboard with carefully crafted UI styles:
* **Minimal:** Clean, zinc-based absolute focus.
* **Serenity:** A calming, organic green workspace.
* **Ember:** Highly legible, warm contrast.
* **Breeze:** Sky-blue clarity.
* **Lavender:** Deep, intellectual purple hues.

---

## 💳 Monetization & Sync

* **Cross-Device Continuity:** Built-in auto-save features ensure that logging into any device instantly reflects your exact workspace layout, nodes, and history.
* **Tiered Workspace System:** Create multiple custom whiteboards and unlock advanced algorithmic features (like *Collider*, *Alchemy*, and *Logic Guide*) based on your paid subscription tier.

---

## 🛠️ Tech Stack

Kno leverages a high-performance modern developer architecture:
* **Frontend Core:** React 18 + TypeScript
* **Intelligence Layer:** Gemini Pro 1.5 via `@google/genai`
* **UI Motion:** Framer Motion
* **Graph Visualization:** D3.js (Heatmaps, Spatial Connections & Networks)
* **Styling:** Tailwind CSS
* **Backend & DB:** Express.js + Firebase (Firestore) / Supabase
* **Document Generation:** `html2canvas`, `jspdf`, `react-pdf`
