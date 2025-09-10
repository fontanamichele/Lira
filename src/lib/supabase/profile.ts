import { createClient } from './client'
import { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

export async function ensureProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient()
  
  try {
    // First, try to get the existing profile
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (existingProfile) {
      return existingProfile
    }

    // If no profile exists, create one
    if (fetchError?.code === 'PGRST116') { // No rows returned
      console.log('No profile found, creating one for user:', userId)
      
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          nickname: null,
          main_currency: null
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating profile:', createError)
        return null
      }

      return newProfile
    }

    console.error('Error fetching profile:', fetchError)
    return null
  } catch (error) {
    console.error('Unexpected error in ensureProfile:', error)
    return null
  }
}
