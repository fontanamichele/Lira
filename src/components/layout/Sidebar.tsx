'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  CreditCard,
  TrendingUp,
  Settings,
  Menu,
  X,
  LogOut
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Accounts', href: '/accounts', icon: CreditCard },
  { name: 'Cashflow', href: '/cashflow', icon: TrendingUp },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-md bg-card border border-border text-foreground hover:bg-accent"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card/95 backdrop-blur-lg border-r border-border/50 transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 lg:w-64 lg:h-screen shadow-xl",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-screen lg:h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4">
            <Image
              src="/assets/logo_full_light.png"
              alt="Lira"
              width={180}
              height={40}
              className="h-10 w-auto"
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 group",
                    isActive
                      ? "bg-primary text-white shadow-lg shadow-primary/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:shadow-md"
                  )}
                >
                  <item.icon className={cn(
                    "mr-3 h-5 w-5 transition-transform duration-200",
                    isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Sign out button */}
          <div className="p-4 border-t border-border/50">
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-3 py-3 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all duration-200 group"
            >
              <LogOut className="mr-3 h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
