import { memo } from 'react'

interface YouTubeEmbedProps {
  videoId: string
}

export const YouTubeEmbed = memo(function YouTubeEmbed({ videoId }: YouTubeEmbedProps) {
  return (
    <div className="mt-2 rounded-lg overflow-hidden bg-black" style={{ aspectRatio: '16 / 9', maxWidth: 320 }}>
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&showinfo=0`}
        title="YouTube player"
        allow="autoplay; encrypted-media"
        allowFullScreen
        className="w-full h-full"
      />
    </div>
  )
})
