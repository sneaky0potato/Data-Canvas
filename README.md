# Data Canvas: Simple Data & Notes Board ✨

A straightforward, browser-based tool for organizing and visualizing data insights. Create interactive plots, write notes, and arrange everything on a flexible canvas, all privately within your browser.

---

## 🚀 Key Features

*   **Flexible Workspace:**
    *   **Movable Blocks:** Drag text and plot blocks anywhere.
    *   **Resizable Text Blocks:** Adjust the size of your notes.
    *   **Snaps & Stacks:** Blocks align to a grid and layer automatically.

*   **Easy Data Import:**
    *   Upload `.dat`, `.csv`, `.tsv`, `.txt` files.
    *   Intelligently parses headers and data, skipping comments.

*   **Markdown Notes:**
    *   Add text blocks for notes and observations.
    *   Supports basic Markdown (headings, bold, lists).
    *   Includes a live preview (toggleable) and HTML sanitization for security.

*   **Interactive Plots (Plotly.js):**
    *   Generate multi-trace plots from your uploaded data.
    *   Customize lines (color, width, style) and markers (symbol, size).
    *   Set plot and axis titles.
    *   Interactive features like zoom and pan.
    *   Clean aesthetic with a light theme.
    *   Export plots as high-resolution PNGs.

*   **Board Management:**
    *   Save and load multiple board layouts, including your data and plot settings, to/from your browser's local storage.
    *   Create new boards or delete old ones.

---

## 🚦 Getting Started

1.  **Download:** Get `index.html`, `styles.css`, and `script.js`.
2.  **Open:** Double-click `index.html` in your web browser. That's it!

---

## ✍️ How to Use

1.  **Upload Data:** Use "Choose Files" to bring in your `.dat` (or similar) files.
2.  **Add Blocks:** Click "Add Text Block" or "Add Plot Block".
3.  **Arrange:** Drag block headers to move them. Resize text blocks from their corners.
4.  **Text Blocks:** Type Markdown in the top box; see preview below.
5.  **Plot Blocks:**
    *   Use "Toggle Settings" to show controls.
    *   Select a data source, X/Y columns, plot type, and customize style.
    *   Click "Add/Update Trace" to define a series.
    *   Click "Render/Update Plot" to see your graph.
    *   Use the "Export Plot" section to save as PNG.

---

## 🛠 Technologies

*   HTML, CSS, JavaScript
*   [Plotly.js](https://plotly.com/javascript/) (for charting)
*   [Marked.js](https://marked.js.org/) (for Markdown parsing)
*   [DOMPurify](https://dompurify.domforge.com/) (for Markdown sanitization)
*   [Toastify-JS](https://apvarun.github.io/toastify-js/) (for notifications)

---

## 📄 License

MIT License

---

## 👤 Author

Google-Gemini and Me

