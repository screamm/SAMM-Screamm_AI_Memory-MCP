# TaskMaster AI för SAM-Screamm_AI_Memory

Den här katalogen innehåller uppgifter som hanteras av TaskMaster AI för SAM-Screamm_AI_Memory-projektet.

## Hur du använder TaskMaster AI

TaskMaster AI hjälper dig att hantera och organisera arbetsuppgifter i ditt projekt. Här är några användbara kommandon:

### Grundläggande kommandon

- **Läs in en PRD/kravspecifikation:** `Can you parse my PRD at path/to/prd.txt?`
- **Lista alla uppgifter:** `What are all the current tasks?`
- **Nästa uppgift:** `What's the next task I should work on?`
- **Hjälp med implementering:** `Can you help me implement task 3?`
- **Expandera en uppgift:** `Can you help me expand task 4?`

### Skapa och hantera uppgifter

- **Skapa ny uppgift:** `Create a new task for [beskrivning]`
- **Markera uppgift som slutförd:** `Mark task 2 as completed`
- **Uppdatera uppgiftsbeskrivning:** `Update task 3 with [ny beskrivning]`

## Uppgiftsfilstruktur

Varje uppgift sparas som en JSON-fil i den här katalogen med följande format:

```json
{
  "id": "1",
  "title": "Uppgiftens titel",
  "description": "Detaljerad beskrivning av uppgiften",
  "status": "pending",
  "priority": "medium",
  "dependencies": [],
  "subtasks": []
}
```

För att lägga till uppgifter manuellt, skapa nya JSON-filer i denna katalog som följer formatet ovan. 