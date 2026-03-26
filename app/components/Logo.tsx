// Renders the Tabletop Tally logo masked with the orange→amber brand gradient.
// The SVG is a square (500×500 viewBox), so height drives the size.
export default function Logo({ className = 'h-10' }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        aspectRatio: '1 / 1',
        background: 'linear-gradient(135deg, #ff6b35 0%, #ffaa00 100%)',
        WebkitMaskImage: 'url(/logo-full.svg)',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        WebkitMaskPosition: 'center',
        maskImage: 'url(/logo-full.svg)',
        maskRepeat: 'no-repeat',
        maskSize: 'contain',
        maskPosition: 'center',
      }}
    />
  )
}
