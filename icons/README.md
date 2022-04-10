# Icons

These icons were created using [Excalidraw](https://excalidraw.com/). The icons are saved in Excalidraw format in [`./icons.excalidraw`](./icons.excalidraw).

Unfortunately, as of this writing, Excalidraw is [not able to embed fonts](https://github.com/excalidraw/excalidraw/issues/1972) in a way that can be read reliably by other programs (such as [Inkscape](https://inkscape.org/)). Thus, to create final SVG files, one can follow this procedure:

1. In Excalidraw, export the icons file as an SVG.
1. Download and install the [Virgil font](https://virgil.excalidraw.com/) on your system.
1. Open the SVG from Excalidraw in a text editor.
1. In the text editor, find and replace all instances of "Virgil, Segoe UI Emoji" with "Virgil 3 YOFF"
1. Open the edited SVG in a program such as Inkscape. Text should render correctly in the opened file.
1. Select all, and click `Path -> Object to Path`
1. To export the individual icons:
   1. Open a second file in Inkscape.
       1. In the new Inkscape file, click `Edit -> XML Editor...`.
       1. In the XML Editor, click the topmost (i.e., `<svg>`) node, and set the `ViewBox` property to [`0 0 100 100`](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts#L265).
   1. Paste an icon from the first file into the new file. Resize the icon to fit the `0 0 100 100` ViewBox set above.  
      _Note that Obsidian will cut off part of the edges of the icon when rendering it. Thus, icons should not touch the edge of the canvas._
   1. Click `File -> Save a Copy...`, and save an SVG of the icon.
