import { Info } from "lucide-react";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";
const explanation =
  "Os elementos são comparados pela posição. Reordenar um array pode gerar diferenças mesmo sem alterar seus valores.";
export function ArrayPolicy({ disabled = false }: { disabled?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          data-operation-disabled={disabled}
          className="array-policy"
          aria-label="Como arrays são comparados"
        >
          <Info />
          <span>Arrays por índice</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-label="Comparação de arrays">
        <PopoverHeader>
          <PopoverTitle>Arrays por índice</PopoverTitle>
          <PopoverDescription>{explanation}</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}
