import * as cp from "child_process";

interface ViewOptions {
  line: number;
  column: number;
  input: string;
  output: string;
  directory?: string;
}

interface ViewRectangle {
  page: number;
  x?: number;
  y?: number;
  W?: number;
  H?: number;
}

/**
 * Performs a forward synchronisation using synctex.
 */
export function view(opts: ViewOptions): Promise<ViewRectangle[]> {
  const args = [
    "synctex view",
    `-i "${opts.line}:${opts.column}:${opts.input}"`,
    `-o "${opts.output}"`,
  ];

  if (typeof opts.directory !== "undefined") {
    args.push(`-d "${opts.directory}"`);
  }

  return new Promise((resolve, reject) => {
    cp.exec(args.join(" "), (err, out) => {
      if (err) {
        return reject(err);
      }

      let rects: ViewRectangle[] = [];
      let rect: ViewRectangle;

      for (const line of out.split("\n")) {
        const [key, val] = line.split(":", 2);

        if (typeof val === "undefined") {
          continue;
        }

        if (key === "Page") {
          rect = { page: parseInt(val, 10) };
          rects.push(rect);
        } else if (["x", "y", "W", "H"].indexOf(key) !== -1) {
          rect[key] = parseFloat(val);
        }
      }

      resolve(rects);
    });
  });
}
