'use client'

import { useCallback, useState, useEffect } from 'react'
import { Avatar, Flex, Heading, IconButton } from '@radix-ui/themes'
import Image from 'next/image'
import NextLink from 'next/link'
import { SignInButton, UserButton, SignedIn, SignedOut } from '@clerk/nextjs'
import { FaGithub, FaMoon, FaSun } from 'react-icons/fa'
import { FiHelpCircle } from 'react-icons/fi'
import { Link } from '../Link'
import { useTheme } from '../Themes'
import { useTourContext } from '../Tour'
import darkIcon from '/public/localelive-dark-icon.png'
import lightIcon from '/public/localelive-light-icon.png'

export const Header = () => {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light')
  const { startTour } = useTourContext()

  useEffect(() => {
    if (resolvedTheme === 'dark' || resolvedTheme === 'light') {
      setCurrentTheme(resolvedTheme)
    }
  }, [resolvedTheme])

  const toggleTheme = useCallback(() => {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    setCurrentTheme(newTheme)
  }, [currentTheme, setTheme])

  return (
    <header className="block sticky top-0 py-2 px-4 z-50 backdrop-blur-xl bg-white/80 dark:bg-[#070810]/80 border border-gray-200/50 dark:border-white/5 shadow-none rounded-b-2xl">
      <Flex align="center" gap="3">
        {currentTheme === 'dark' ? (
          <Image src={darkIcon} alt="Dark Mode Icon" width={70} height={70} className="md:w-[70px] w-[40px]" />
        ) : (
          <Image src={lightIcon} alt="Light Mode Icon" width={70} height={70} className="md:w-[70px] w-[40px]" />
        )}
        <NextLink href="/">
          <Heading
            as="h3"
            size="3"
            style={{ maxWidth: 400 }}
            className="text-gray-900 dark:text-white"
          >
            <span className="hidden md:inline">LocaleLive: Your Smart Local Guide</span>
            <span className="md:hidden">LocaleLive</span>
          </Heading>
        </NextLink>
        <Flex align="center" gap="3" className="ml-auto">
          <Avatar
            color="gray"
            size="2"
            radius="full"
            fallback={
              <Link href="https://github.com/SensorsConnect">
                <FaGithub className="text-gray-600 dark:text-gray-400" />
              </Link>
            }
          />
          <div
            onClick={toggleTheme}
            className="cursor-pointer text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          >
            {currentTheme === 'dark' ? <FaSun size={20} /> : <FaMoon size={20} />}
          </div>
          <button
            onClick={startTour}
            title="Take the tour"
            aria-label="Take the tour"
            className="cursor-pointer text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-neon-cyan transition-colors"
          >
            <FiHelpCircle size={20} />
          </button>
          <div data-tour="profile-menu" className="flex items-center">
            <SignedOut>
              <SignInButton mode="modal">
                <button
                  className="text-sm px-3 py-1.5 rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700"
                >
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </Flex>
      </Flex>
    </header>
  )
}
