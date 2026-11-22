/** Scoped stylesheets: the compiled class map the bundler inlines. */
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

/**
 * Plain stylesheets, which the bundler inlines into the plugin's own style
 * tag. They export nothing: importing one is the whole point.
 */
declare module '*.css' {}
