import type { VercelRequest, VercelResponse } from '@vercel/node'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  'mailto:' + process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { supplierId, orderId } = req.body as { supplierId: string; orderId: string }
  if (!supplierId || !orderId) return res.status(400).json({ error: 'Missing params' })

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', supplierId)
    .single()

  if (error || !data) return res.status(200).json({ sent: false })

  try {
    await webpush.sendNotification(
      data.subscription as webpush.PushSubscription,
      JSON.stringify({
        title: 'Novo pedido recebido!',
        body: `Pedido #${orderId.slice(0, 8).toUpperCase()} aguardando confirmação.`,
        url: '/supplier/orders',
      }),
    )
    res.status(200).json({ sent: true })
  } catch {
    res.status(200).json({ sent: false })
  }
}
