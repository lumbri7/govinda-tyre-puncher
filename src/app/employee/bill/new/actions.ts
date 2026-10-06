'use server'

import { redirect } from 'next/navigation'

import { type ActionState, actionError, humanizeDatabaseError } from '@/lib/action-state'
import { requireEmployee } from '@/lib/auth'
import { billSchema, fieldErrors } from '@/lib/validation'
import { createClient } from '@/lib/supabase/server'

export async function submitBill(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEmployee()

  let items: unknown = []
  try {
    items = JSON.parse(String(formData.get('items') ?? '[]'))
  } catch {
    return actionError('The bill could not be read. Please start again.')
  }

  const rawItems = Array.isArray(items) ? items : []
  const parsed = billSchema.safeParse({
    customerName: String(formData.get('customerName') ?? ''),
    customerPhone: String(formData.get('customerPhone') ?? ''),
    vehicleType: String(formData.get('vehicleType') ?? ''),
    vehicleNumber: String(formData.get('vehicleNumber') ?? ''),
    vehicleDescription: String(formData.get('vehicleDescription') ?? ''),
    items: rawItems.map((item) => {
      const entry = item as {
        item_type?: string
        name?: string
        quantity?: string
        unit_price?: string
      }
      // The hidden field is the rpc payload; convert it back for validation.
      return {
        itemType: entry.item_type,
        name: entry.name,
        quantityCenti: Number(entry.quantity ?? 0) * 100,
        unitPricePaise: Number(entry.unit_price ?? 0) * 100,
      }
    }),
  })

  if (!parsed.success) {
    return actionError('Check the bill details and try again.', fieldErrors(parsed.error))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_bill', {
    p_customer_name: parsed.data.customerName,
    p_vehicle_type: parsed.data.vehicleType,
    p_vehicle_number: parsed.data.vehicleNumber,
    p_items: rawItems,
    p_customer_phone: parsed.data.customerPhone,
    p_vehicle_description:
      parsed.data.vehicleType === 'other' ? parsed.data.vehicleDescription : null,
  })

  if (error || !data) {
    return actionError(humanizeDatabaseError(error?.message ?? 'The bill could not be saved.'))
  }

  redirect(`/employee/bills/${data.id}?saved=1`)
}