# Diagram drafts

Excalidraw drafts made with the `excalidraw` MCP server (configured in `/.mcp.json`) are saved here as `.excalidraw` files. They are working sketches, such as page flows and process diagrams. They are not site assets: the finished visuals are built as SVG components in `src/components/visuals` (see `docs/visual-style.md`).

The canvas runs locally on http://127.0.0.1:3100 (port 3000 is left free for `next dev`). Open that address in a browser to watch a diagram being drawn. The `export_to_excalidraw_url` tool uploads an encrypted copy of the drawing to excalidraw.com, so don't use it for anything private.
