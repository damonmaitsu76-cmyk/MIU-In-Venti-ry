import { ImageIcon, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { imageUrlFor } from '@/lib/images'

export default function ImageUpload({ product, onFileChange, onRemove, disabled }) {
  const [preview, setPreview] = useState(null)
  const previewRef = useRef(null)
  const remoteUrl = imageUrlFor(product)

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current) }, [])

  const imageUrl = preview || remoteUrl
  function chooseFile(event) {
    const selected = event.target.files?.[0]
    if (selected) {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
      previewRef.current = URL.createObjectURL(selected)
      setPreview(previewRef.current)
      onFileChange(selected)
    }
    event.target.value = ''
  }
  function remove() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = null
    setPreview(null)
    onRemove()
  }

  return (
    <div className="grid gap-2">
      <div className="flex aspect-[4/3] max-w-sm items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted">
        {imageUrl ? <img src={imageUrl} alt="Product preview" className="size-full object-cover" /> : <ImageIcon className="size-9 text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground shadow-xs hover:bg-muted">
          <Upload className="size-4" />Choose image
          <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} disabled={disabled} />
        </label>
        {imageUrl && <Button type="button" variant="outline" size="lg" onClick={remove} disabled={disabled}><Trash2 />Remove</Button>}
      </div>
      <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP up to 5 MB. Images are resized before upload.</p>
    </div>
  )
}
