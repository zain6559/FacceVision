function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-none bg-muted/50 ${className}`}
      {...props}
    />
  )
}

export { Skeleton }
