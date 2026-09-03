"use client"

import {
  Bell,
  BellOff,
  Check,
  Mic,
  MicOff,
  Moon,
  Power,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react"
import { Switch } from "@/components/ui/heroui-switch"

export default function WithIcons() {
  const icons = {
    check: {
      off: Power,
      on: Check,
      selectedControlClass: "bg-green-500/80",
    },
    darkMode: {
      off: Moon,
      on: Sun,
      selectedControlClass: "",
    },
    microphone: {
      off: Mic,
      on: MicOff,
      selectedControlClass: "bg-red-500/80",
    },
    notification: {
      off: BellOff,
      on: Bell,
      selectedControlClass: "bg-purple-500/80",
    },
    volume: {
      off: Volume2,
      on: VolumeX,
      selectedControlClass: "bg-blue-500/80",
    },
  }

  return (
    <div className="flex gap-3">
      {Object.entries(icons).map(([key, value]) => (
        <Switch key={key} defaultSelected aria-label={key} size="lg">
          {({ isSelected }) => (
            <Switch.Content>
              <Switch.Control className={isSelected ? value.selectedControlClass : ""}>
                <Switch.Thumb>
                  <Switch.Icon>
                    {isSelected ? (
                      <value.on className="size-3 text-inherit opacity-100" />
                    ) : (
                      <value.off className="size-3 text-inherit opacity-70" />
                    )}
                  </Switch.Icon>
                </Switch.Thumb>
              </Switch.Control>
            </Switch.Content>
          )}
        </Switch>
      ))}
    </div>
  )
}
