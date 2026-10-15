import { useState } from 'react'
import { Info } from 'lucide-react'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from './ui/popover'
const explanation = 'Os elementos são comparados pela posição. Reordenar um array pode gerar diferenças mesmo sem alterar seus valores.'
export function ArrayPolicy() {
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState(false)
  return <Popover open={open} onOpenChange={value => { setOpen(value); setHint(false) }}>
    <Tooltip open={!open && hint} onOpenChange={setHint}><TooltipTrigger asChild><PopoverTrigger asChild><Button variant="ghost" className="array-policy" aria-label="Como arrays são comparados"><Info /><span>Arrays por índice</span></Button></PopoverTrigger></TooltipTrigger><TooltipContent className="policy-tooltip" sideOffset={8}>{explanation}</TooltipContent></Tooltip>
    <PopoverContent align="start" aria-label="Comparação de arrays"><PopoverHeader><PopoverTitle>Arrays por índice</PopoverTitle><PopoverDescription>{explanation}</PopoverDescription></PopoverHeader></PopoverContent>
  </Popover>
}
