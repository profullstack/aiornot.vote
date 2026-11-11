// Declarative WebMCP attributes (webmachinelearning.github.io/webmcp), which the
// @profullstack/webmcp embed polyfills. React passes unknown lowercase
// attributes through to the DOM; this only teaches TypeScript their names.
import "react";

declare module "react" {
  interface FormHTMLAttributes<T> {
    toolname?: string;
    tooldescription?: string;
    toolautosubmit?: string | boolean;
  }
  interface InputHTMLAttributes<T> {
    toolparamdescription?: string;
  }
}
