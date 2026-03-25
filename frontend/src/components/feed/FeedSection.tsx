import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { FeedSection as FeedSectionType } from '@/lib/types'
import { PaperCard } from './PaperCard'
import { cn } from '@/lib/utils'

interface Props {
  section: FeedSectionType
  sectionIndex?: number
}

interface SectionMeta {
  borderClass: string
  titleClass: string
  subtitleColor: string
  subtitle: string
  showLive: boolean
}

function getMeta(type: FeedSectionType['section_type']): SectionMeta {
  switch (type) {
    case 'trending':
      return {
        borderClass: 'section-border-trending',
        titleClass: 'text-gradient-orange',
        subtitleColor: 'text-orange-400/65',
        subtitle: 'Papers gaining the most momentum this week',
        showLive: true,
      }
    case 'rising':
      return {
        borderClass: 'section-border-rising',
        titleClass: 'text-gradient-green',
        subtitleColor: 'text-green-400/65',
        subtitle: 'Fast-growing papers worth watching now',
        showLive: false,
      }
    case 'hidden_gems':
      return {
        borderClass: 'section-border-hidden',
        titleClass: 'text-gradient-purple',
        subtitleColor: 'text-purple-400/65',
        subtitle: 'High-quality research flying under the radar',
        showLive: false,
      }
    case 'new':
      return {
        borderClass: 'section-border-new',
        titleClass: 'text-gradient',
        subtitleColor: 'text-cyan-400/65',
        subtitle: 'Latest papers added to the intelligence feed',
        showLive: false,
      }
    case 'you_missed':
      return {
        borderClass: 'section-border-missed',
        titleClass: 'text-orange-300',
        subtitleColor: 'text-amber-400/65',
        subtitle: 'Top-scored papers that haven\'t gotten enough attention yet',
        showLive: false,
      }
    case 'personalized':
      return {
        borderClass: 'section-border-personal',
        titleClass: 'text-gradient',
        subtitleColor: 'text-accent-2/65',
        subtitle: 'Recommended based on your reading history',
        showLive: false,
      }
    default:
      return {
        borderClass: 'section-border-personal',
        titleClass: 'text-white',
        subtitleColor: 'text-muted',
        subtitle: '',
        showLive: false,
      }
  }
}

export function FeedSection({ section, sectionIndex = 0 }: Props) {
  if (!section.papers.length) return null
  const meta = getMeta(section.section_type)

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: sectionIndex * 0.07, duration: 0.45 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className={cn('flex items-start justify-between gap-4 py-1', meta.borderClass)}>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className={cn('text-lg font-bold', meta.titleClass)}>{section.title}</h2>
            <span className="text-xs text-muted bg-surface-2 border border-accent/15 px-2 py-0.5 rounded-full">
              {section.total} papers
            </span>
            {meta.showLive && (
              <span className="flex items-center gap-1.5 text-xs text-orange-400/80">
                <span className="live-dot" /> live
              </span>
            )}
          </div>
          {meta.subtitle && (
            <p className={cn('text-xs', meta.subtitleColor)}>{meta.subtitle}</p>
          )}
        </div>
        {section.total > section.papers.length && (
          <button className="flex items-center gap-1 text-xs text-muted hover:text-white transition-colors shrink-0 mt-1">
            See all <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="feed-grid">
        {section.papers.map((paper, i) => (
          <PaperCard
            key={paper.id}
            paper={paper}
            index={i}
            sectionType={section.section_type}
          />
        ))}
      </div>
    </motion.section>
  )
}
