export function openWhatsApp(phone: string, message: string): void {
  const cleanPhone = phone.replace(/\D/g, '')
  const url = `https://wa.me/${cleanPhone}?text=${message}`
  window.open(url, '_blank')
}

export function openSupportWhatsApp(): void {
  const supportPhone = import.meta.env.VITE_SUPPORT_WHATSAPP as string
  const message = encodeURIComponent('Olá! Preciso de ajuda com a Rota Verde.')
  openWhatsApp(supportPhone || '5511999999999', message)
}
