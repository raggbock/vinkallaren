import { StyleSheet, Text, View } from "react-native";
import { colors } from "../styles/theme";
import { generateAvatarColor, getAvatarLetter } from "../lib/profile-actions";

type AvatarProps = {
  displayName: string | null;
  userId: string;
  avatarColor?: string | null;
  size?: number;
};

export function Avatar({ displayName, userId, avatarColor, size = 32 }: AvatarProps) {
  const bg = avatarColor || generateAvatarColor(userId);
  const letter = getAvatarLetter(displayName);
  const fontSize = size * 0.45;
  return (
    <View style={[s.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[s.letter, { fontSize }]}>{letter}</Text>
    </View>
  );
}

type AvatarRowProps = {
  participants: Array<{ user_id: string; display_name: string | null; avatar_color?: string | null }>;
  size?: number;
  max?: number;
};

export function AvatarRow({ participants, size = 28, max = 8 }: AvatarRowProps) {
  const shown = participants.slice(0, max);
  const overflow = participants.length - max;
  return (
    <View style={s.row}>
      {shown.map((p, i) => (
        <View key={p.user_id} style={[s.rowItem, i > 0 && { marginLeft: -size * 0.15 }]}>
          <Avatar displayName={p.display_name} userId={p.user_id} avatarColor={p.avatar_color} size={size} />
        </View>
      ))}
      {overflow > 0 ? (
        <View style={[s.circle, s.overflow, { width: size, height: size, borderRadius: size / 2, marginLeft: -size * 0.15 }]}>
          <Text style={[s.letter, { fontSize: size * 0.35 }]}>+{overflow}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.textLight,
  },
  letter: {
    color: colors.textLight,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowItem: {
    zIndex: 1,
  },
  overflow: {
    backgroundColor: colors.textSecondary,
    zIndex: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.textLight,
  },
});
