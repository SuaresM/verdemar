import { supabase } from '../lib/supabaseClient'

export async function uploadImage(
  file: File,
  bucket: string,
  path: string
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadProductImage(file: File, supplierId: string): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${supplierId}/${Date.now()}.${ext}`
  return uploadImage(file, 'product-images', path)
}

export async function uploadSupplierLogo(file: File, supplierId: string): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${supplierId}/logo.${ext}`
  return uploadImage(file, 'supplier-assets', path)
}

export async function uploadSupplierBanner(file: File, supplierId: string): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${supplierId}/banner.${ext}`
  return uploadImage(file, 'supplier-assets', path)
}
