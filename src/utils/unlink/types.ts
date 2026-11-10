export type LinkedKey<T extends object, Prefix extends string> = {
  [K in keyof T]-?: K extends `${Prefix}${string}` ? (NonNullable<T[K]> extends T ? K : never) : never;
}[keyof T];

export type EndpointKey<O extends object, T extends object, Suffix extends string> = {
  [K in keyof O]-?: K extends `${string}${Suffix}` | `${string}${Uncapitalize<Suffix>}`
    ? NonNullable<O[K]> extends T
      ? K
      : never
    : never;
}[keyof O];

export type LinkedNode<T extends object> = {
  [K in LinkedKey<T, 'prev'> | LinkedKey<T, 'next'>]: LinkedNode<T> | undefined;
};

export type LinkedOwner<O extends object, T extends object> = {
  [K in EndpointKey<O, T, 'Head'> | EndpointKey<O, T, 'Tail'>]: LinkedNode<T> | undefined;
};
