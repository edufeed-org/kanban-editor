import Root from "./avatar.svelte";
import Image from "./avatar-image.svelte";
import Fallback from "./avatar-fallback.svelte";


/**
 * Generiert Initialen aus User-Name
 */
function getInitials(name?: string): string {
	if (!name) return '?';
	const parts = name.split(' ');
	if (parts.length > 1) {
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}
	return name.substring(0, 2).toUpperCase();
}

/**
 * Generiert Avatar-Farbe basierend auf User-Name
 * Für konsistente Farbgebung pro Nutzer
 */
function getAvatarColor(name?: string): string {
	if (!name) return 'bg-slate-500';
	const colors = [
		'bg-red-500',
		'bg-blue-500',
		'bg-green-500',
		'bg-yellow-500',
		'bg-purple-500',
		'bg-pink-500',
		'bg-cyan-500',
		'bg-orange-500'
	];
	const hash = name.charCodeAt(0);
	return colors[hash % colors.length];
}

export {
	Root,
	Image,
	Fallback,
	//
	Root as Avatar,
	Image as AvatarImage,
	Fallback as AvatarFallback,
	getInitials,
	getAvatarColor,
};
