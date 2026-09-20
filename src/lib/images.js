import { supabase } from '@/supabaseClient'

export function imageUrlFor(product) {
  if (product?.image_path) return supabase.storage.from('product-images').getPublicUrl(product.image_path).data.publicUrl
  return product?.image_url || null
}

export async function resizeProductImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use a JPEG, PNG, or WebP image.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('Could not prepare this image. Please try another photo.')
  return blob
}

export async function uploadProductImage(file) {
  const blob = await resizeProductImage(file)
  const path = `products/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('product-images').upload(path, blob, {
    cacheControl: '31536000', contentType: 'image/jpeg', upsert: false,
  })
  if (error) throw error
  return path
}
