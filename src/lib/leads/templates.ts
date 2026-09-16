import { firstName } from '@/lib/format';

export type Template = { id: string; label: string; subject: string; body: string };

type Vars = { leadName: string; userName: string };

/** Quick responses. Kept short and generic so they fit any CreateX client. */
export function emailTemplates({ leadName, userName }: Vars): Template[] {
  const hi = `Здравейте, ${firstName(leadName)},`;
  const bye = `Поздрави,\n${userName}`;
  return [
    {
      id: 'first',
      label: 'Първи контакт',
      subject: 'Относно вашето запитване',
      body: `${hi}\n\nБлагодаря за запитването. Кога е удобно да ви се обадя, за да обсъдим детайлите?\n\n${bye}`,
    },
    {
      id: 'missed',
      label: 'Не успях да се свържа',
      subject: 'Опитах да се свържа с вас',
      body: `${hi}\n\nОпитах да ви се обадя във връзка с вашето запитване, но не успях да се свържа. Кога е удобно да ви звънна отново?\n\n${bye}`,
    },
    {
      id: 'reminder',
      label: 'Напомняне',
      subject: 'Напомняне за вашето запитване',
      body: `${hi}\n\nПиша ви да проверя дали все още имате интерес. Ако имате въпроси, просто отговорете на този имейл.\n\n${bye}`,
    },
  ];
}
