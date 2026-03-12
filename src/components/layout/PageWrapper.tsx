interface PageWrapperProps {
  children: React.ReactNode
  className?: string
}

export function PageWrapper({ children, className = '' }: PageWrapperProps) {
  return (
    <main className={`flex-1 overflow-y-auto pb-20 ${className}`}>
      {children}
    </main>
  )
}
