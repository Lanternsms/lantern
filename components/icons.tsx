'use client'

/**
 * Hugeicons under the names the app already uses (they started as Lucide imports).
 * Every icon draws from one set at one stroke, and accepts the props pages already pass.
 */
import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'
import {
  Add01Icon,
  Alert02Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowRight02Icon,
  ArrowUp01Icon,
  ArrowUpRight01Icon,
  Award01Icon,
  BookOpen01Icon,
  Bookmark01Icon,
  Briefcase01Icon,
  Building03Icon,
  Calendar01Icon,
  Calendar02Icon,
  Calendar03Icon,
  CalendarCheckIn01Icon,
  Camera01Icon,
  Cancel01Icon,
  CancelCircleIcon,
  ChartColumnIcon,
  ChartIncreaseIcon,
  CheckmarkCircle02Icon,
  CheckmarkSquare02Icon,
  ClipboardIcon,
  Clock01Icon,
  CloudUploadIcon,
  CreditCardIcon,
  Delete02Icon,
  Download01Icon,
  File01Icon,
  GitBranchIcon,
  InformationCircleIcon,
  Key01Icon,
  LaptopIcon,
  Layers01Icon,
  Link01Icon,
  Loading03Icon,
  LockIcon,
  Mail01Icon,
  Message01Icon,
  Mortarboard01Icon,
  Notification01Icon,
  PencilEdit02Icon,
  PlayCircleIcon,
  RefreshIcon,
  RotateLeft01Icon,
  School01Icon,
  SecurityCheckIcon,
  SecurityWarningIcon,
  SentIcon,
  Settings01Icon,
  Share08Icon,
  Shield01Icon,
  SlidersHorizontalIcon,
  SmartPhone01Icon,
  SparklesIcon,
  TaskAdd01Icon,
  Tick02Icon,
  Upload01Icon,
  UserAdd01Icon,
  UserCheck01Icon,
  UserIcon,
  UserMultipleIcon,
  UserSettings01Icon,
  ViewIcon,
  ViewOffSlashIcon,
  Wallet01Icon,
  Xls01Icon,
} from '@hugeicons/core-free-icons'

export type IconProps = {
  size?: number | string
  className?: string
  strokeWidth?: number
  color?: string
  'aria-hidden'?: boolean | 'true' | 'false'
  'aria-label'?: string
  style?: React.CSSProperties
}

function make(icon: IconSvgElement, name: string) {
  function C({ size = 20, strokeWidth = 1.8, 'aria-label': label, ...rest }: IconProps) {
    return (
      <HugeiconsIcon
        icon={icon}
        size={typeof size === 'string' ? Number.parseInt(size, 10) || 20 : size}
        strokeWidth={Math.max(strokeWidth, 1.5)}
        aria-hidden={label ? undefined : true}
        aria-label={label}
        {...rest}
      />
    )
  }
  C.displayName = name
  return C
}

export const AlertCircle = make(AlertCircleIcon, 'AlertCircle')
export const AlertTriangle = make(Alert02Icon, 'AlertTriangle')
export const ArrowDown = make(ArrowDown01Icon, 'ArrowDown')
export const ArrowRight = make(ArrowRight02Icon, 'ArrowRight')
export const ArrowUp = make(ArrowUp01Icon, 'ArrowUp')
export const ArrowUpRight = make(ArrowUpRight01Icon, 'ArrowUpRight')
export const Award = make(Award01Icon, 'Award')
export const BarChart3 = make(ChartColumnIcon, 'BarChart3')
export const Bell = make(Notification01Icon, 'Bell')
export const BookMarked = make(Bookmark01Icon, 'BookMarked')
export const BookOpen = make(BookOpen01Icon, 'BookOpen')
export const Briefcase = make(Briefcase01Icon, 'Briefcase')
export const Building2 = make(Building03Icon, 'Building2')
export const Calendar = make(Calendar03Icon, 'Calendar')
export const CalendarCheck = make(CalendarCheckIn01Icon, 'CalendarCheck')
export const CalendarDays = make(Calendar01Icon, 'CalendarDays')
export const CalendarRange = make(Calendar02Icon, 'CalendarRange')
export const Camera = make(Camera01Icon, 'Camera')
export const Check = make(Tick02Icon, 'Check')
export const CheckCircle2 = make(CheckmarkCircle02Icon, 'CheckCircle2')
export const CheckCircle = make(CheckmarkCircle02Icon, 'CheckCircle')
export const CheckSquare = make(CheckmarkSquare02Icon, 'CheckSquare')
export const ChevronRight = make(ArrowRight01Icon, 'ChevronRight')
export const ClipboardList = make(ClipboardIcon, 'ClipboardList')
export const Clock = make(Clock01Icon, 'Clock')
export const CreditCard = make(CreditCardIcon, 'CreditCard')
export const Download = make(Download01Icon, 'Download')
export const Eye = make(ViewIcon, 'Eye')
export const EyeOff = make(ViewOffSlashIcon, 'EyeOff')
export const FileSpreadsheet = make(Xls01Icon, 'FileSpreadsheet')
export const FileText = make(File01Icon, 'FileText')
export const GitBranch = make(GitBranchIcon, 'GitBranch')
export const GraduationCap = make(Mortarboard01Icon, 'GraduationCap')
export const Info = make(InformationCircleIcon, 'Info')
export const Key = make(Key01Icon, 'Key')
export const Laptop = make(LaptopIcon, 'Laptop')
export const Layers = make(Layers01Icon, 'Layers')
export const Link2 = make(Link01Icon, 'Link2')
export const ListPlus = make(TaskAdd01Icon, 'ListPlus')
export const Loader2 = make(Loading03Icon, 'Loader2')
export const Lock = make(LockIcon, 'Lock')
export const Mail = make(Mail01Icon, 'Mail')
export const MessageSquare = make(Message01Icon, 'MessageSquare')
export const Pencil = make(PencilEdit02Icon, 'Pencil')
export const PlayCircle = make(PlayCircleIcon, 'PlayCircle')
export const Plus = make(Add01Icon, 'Plus')
export const RefreshCw = make(RefreshIcon, 'RefreshCw')
export const RotateCcw = make(RotateLeft01Icon, 'RotateCcw')
export const School = make(School01Icon, 'School')
export const Send = make(SentIcon, 'Send')
export const Settings = make(Settings01Icon, 'Settings')
export const Share = make(Share08Icon, 'Share')
export const Shield = make(Shield01Icon, 'Shield')
export const ShieldAlert = make(SecurityWarningIcon, 'ShieldAlert')
export const ShieldCheck = make(SecurityCheckIcon, 'ShieldCheck')
export const SlidersHorizontal = make(SlidersHorizontalIcon, 'SlidersHorizontal')
export const Smartphone = make(SmartPhone01Icon, 'Smartphone')
export const Sparkles = make(SparklesIcon, 'Sparkles')
export const Trash2 = make(Delete02Icon, 'Trash2')
export const TrendingUp = make(ChartIncreaseIcon, 'TrendingUp')
export const Upload = make(Upload01Icon, 'Upload')
export const UploadCloud = make(CloudUploadIcon, 'UploadCloud')
export const User = make(UserIcon, 'User')
export const UserCheck = make(UserCheck01Icon, 'UserCheck')
export const UserCog = make(UserSettings01Icon, 'UserCog')
export const UserPlus = make(UserAdd01Icon, 'UserPlus')
export const Users = make(UserMultipleIcon, 'Users')
export const Wallet = make(Wallet01Icon, 'Wallet')
export const X = make(Cancel01Icon, 'X')
export const XCircle = make(CancelCircleIcon, 'XCircle')
