import type { AdapterFormState } from '../../services/adapter-form'
import { StepBasics, StepTransport } from './StepBasics'
import type { IdCollision } from './StepBasics'
import { StepGenres, StepPagination, StepUrls } from './StepGenres'
import { StepStructure } from './StepStructure'

function FormSection({ children }: { children: React.ReactNode }) {
  return <section className="border-t border-border-main pt-4 first:border-t-0 first:pt-0">{children}</section>
}

export function StepForm({
  form,
  patch,
  collision,
  existingIds,
}: {
  form: AdapterFormState
  patch: (p: Partial<AdapterFormState>) => void
  collision: IdCollision | null
  existingIds: string[]
}) {
  return (
    <div className="space-y-4">
      <FormSection>
        <StepBasics form={form} patch={patch} collision={collision} existingIds={existingIds} />
      </FormSection>
      <FormSection>
        <StepTransport form={form} patch={patch} />
      </FormSection>
      <FormSection>
        <StepGenres form={form} patch={patch} />
      </FormSection>
      <FormSection>
        <StepPagination form={form} patch={patch} />
      </FormSection>
      <FormSection>
        <StepStructure form={form} patch={patch} />
      </FormSection>
      <FormSection>
        <StepUrls form={form} patch={patch} />
      </FormSection>
    </div>
  )
}
