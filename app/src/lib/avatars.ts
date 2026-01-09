export const avatarPool = [
  "/avatars/avatar_1.jpg",
  "/avatars/avatar_2.jpg",
  "/avatars/avatar_3.jpg",
  "/avatars/avatar_4.jpg",
  "/avatars/avatar_5.jpg",
  "/avatars/avatar_6.jpg",
  "/avatars/avatar_7.jpg",
];

export function getRandomAvatarUrl() {
  return avatarPool[Math.floor(Math.random() * avatarPool.length)];
}
