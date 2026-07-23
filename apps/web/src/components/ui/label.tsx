import * as React from "react"
export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(({ className = '', ...props }, ref) => (
  <label ref={ref} className={`text-xs font-mono uppercase text-muted-foreground ${className}`} {...props} />
))
Label.displayName = "Label"
