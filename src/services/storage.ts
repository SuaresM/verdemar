import { supabase } from '../lib/supabaseClient'

const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

function validateImageFile(file: File): void {
  if (!VALID_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Tipo de arquivo inválido. Apenas imagens (JPEG, PNG, WebP, GIF) são permitidas.')
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Arquivo muito grande. O tamanho máximo é 5MB.')
  }
}

function getImageExtension(file: File): string {
  return MIME_TO_EXT[file.type] || 'jpg'
}

export async function uploadImage(
  file: File,
  bucket: string,
  path: string
): Promise<string> {
  validateImageFile(file)

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadProductImage(file: File, supplierId: string): Promise<string> {
  const ext = getImageExtension(file)
  const path = `${supplierId}/${Date.now()}.${ext}`
  return uploadImage(file, 'product-images', path)
}

export async function uploadSupplierLogo(file: File, supplierId: string): Promise<string> {
  const ext = getImageExtension(file)
  const path = `${supplierId}/logo.${ext}`
  return uploadImage(file, 'supplier-assets', path)
}

export async function uploadSupplierBanner(file: File, supplierId: string): Promise<string> {
  const ext = getImageExtension(file)
  const path = `${supplierId}/banner.${ext}`
  return uploadImage(file, 'supplier-assets', path)
}
