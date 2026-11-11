export type TLinkedKey<T extends object, Prefix extends string> = {
  [K in keyof T]-?: K extends `${Prefix}${string}` ? (NonNullable<T[K]> extends T ? K : never) : never;
}[keyof T];

export type TEndpointKey<O extends object, T extends object, Suffix extends string> = {
  [K in keyof O]-?: K extends `${string}${Suffix}` | `${string}${Uncapitalize<Suffix>}`
    ? NonNullable<O[K]> extends T
      ? K
      : never
    : never;
}[keyof O];

export type TLinkedNode<T extends object> = {
  [K in TLinkedKey<T, 'prev'> | TLinkedKey<T, 'next'>]: TLinkedNode<T> | undefined;
};

export type TLinkedOwner<O extends object, T extends object> = {
  [K in TEndpointKey<O, T, 'Head'> | TEndpointKey<O, T, 'Tail'>]: TLinkedNode<T> | undefined;
};

export const EAddType = {
  prepend: 'prepend',
  append: 'append',
} as const;
export type EAddType = (typeof EAddType)[keyof typeof EAddType];
