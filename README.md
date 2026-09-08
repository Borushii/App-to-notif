# Rappels — notifications récurrentes

Application mobile (iOS + Android) qui envoie des rappels en notification à
**intervalle choisi** (toutes les 30 min, toutes les heures…) et **uniquement
pendant une plage horaire** que vous définissez.

Construite avec Expo (SDK 57) / React Native. Les notifications sont
**locales** : rien ne transite par un serveur, tout est planifié par le
système d'exploitation du téléphone, donc les rappels arrivent même hors
ligne et application fermée.

## Fonctionnalités

- **Intervalle** — préréglages de 5 min à 4 h, plus un réglage fin par pas de
  5 min (de 1 min à 12 h).
- **Plage horaire** — heure de début et de fin ; les plages à cheval sur
  minuit (22:00 → 06:00) sont gérées.
- **Jours actifs** — sélection jour par jour, avec les raccourcis « Tous les
  jours », « En semaine » et « Week-end ».
- **Plusieurs rappels** en parallèle, chacun avec son titre et son message.
- **Interrupteur de pause** par rappel, sans perdre son réglage.
- **Prochaine sonnerie** affichée sur chaque carte.
- **Notification de test** pour vérifier les autorisations en 5 secondes.
- Réglages **persistés** localement (AsyncStorage) et resynchronisés au
  démarrage.

## Démarrage

```bash
npm install
npm start
```

Puis scannez le QR code avec l'application **Expo Go**, ou lancez
`npm run android` / `npm run ios`.

Pour une application installable (icône, notifications en arrière-plan sur la
durée), passez par une *development build* ou EAS Build :

```bash
npx expo run:android      # nécessite Android Studio
npx expo run:ios          # nécessite macOS + Xcode
```

### Obtenir un APK de test

Le dépôt compile l'APK sur GitHub Actions (workflow **APK Android**), sans
outillage local :

1. Onglet **Actions** → workflow **APK Android** → **Run workflow**.
2. À la fin du run, télécharger l'artefact **rappels-apk** (un `.zip`).
3. Le décompresser et transférer le `.apk` sur le téléphone, puis l'installer
   en autorisant les « sources inconnues » pour l'application qui ouvre le
   fichier.

Le workflow se déclenche aussi automatiquement à chaque push sur `main` ou sur
une branche `claude/**`.

L'APK est signé avec le **keystore de debug** du modèle React Native : c'est
suffisant pour une installation manuelle de test, mais il faut un keystore
dédié avant toute publication sur le Play Store.

Pour compiler localement (nécessite Android Studio et un JDK 17) :

```bash
npm run apk
# android/app/build/outputs/apk/release/app-release.apk
```

### Vérifications

```bash
npm test        # logique de planification (node --test)
npm run typecheck
```

## Comment la planification fonctionne

Le système n'expose pas de « répète toutes les 30 minutes, mais seulement
entre 9h et 18h ». L'application traduit donc chaque rappel en **une liste
d'heures fixes**, puis programme un déclencheur système par heure :

```
09:00 – 18:00, toutes les 30 min
  → 09:00, 09:30, 10:00, … 18:00   (19 créneaux)
```

- **7 jours actifs** → un déclencheur *quotidien* par créneau.
- **Semaine partielle** → un déclencheur *hebdomadaire* par créneau **et** par
  jour sélectionné (2 jours × 19 créneaux = 38 déclencheurs).

Ces déclencheurs se répètent indéfiniment : aucune tâche de fond n'est
nécessaire, et l'application n'a pas besoin d'être ouverte.

### Limite d'iOS : 64 notifications en attente

iOS ne conserve que **64 notifications planifiées par application** et ignore
silencieusement les suivantes. L'application :

- affiche en direct le nombre de créneaux consommés par un rappel et le total
  (budget de **60**, pour garder une marge) ;
- refuse d'enregistrer un rappel dépassant **48 créneaux** à lui seul ;
- avertit quand le total dépasse le budget, avec la marche à suivre (allonger
  l'intervalle, réduire la plage, mettre un rappel en pause).

Concrètement : un intervalle de 30 min sur 12 h tous les jours coûte 25
créneaux ; le même rappel limité au lundi et au mercredi en coûte 50.

### Plages de nuit

Pour une plage 22:00 → 06:00, les jours sélectionnés s'appliquent à **l'heure
de chaque notification**, pas à la nuit entière : « lundi » déclenche les
créneaux de 22:00 à 23:30 le lundi soir *et* ceux de 00:00 à 06:00 le lundi
matin. L'éditeur le rappelle dès qu'une plage passe minuit.

## Structure

```
App.tsx                      Racine (SafeAreaProvider + HomeScreen)
src/types.ts                 Type Reminder
src/schedule.ts              Logique pure : créneaux, durées, formats (testée)
src/notifications.ts         Permissions, canal Android, (re)planification
src/storage.ts               Persistance AsyncStorage + normalisation
src/theme.ts                 Couleurs, espacements, rayons
src/screens/HomeScreen.tsx   Liste, autorisations, édition, test
src/components/              ReminderCard, ReminderEditor, TimeField, Chip
__tests__/schedule.test.ts   Tests de la logique de planification
```

## Limites connues

- Les notifications **push distantes** ne sont pas utilisées : les rappels sont
  locaux, donc pilotables uniquement depuis le téléphone.
- Sur Android, certains constructeurs (Xiaomi, Huawei, Oppo…) restreignent
  agressivement les applications en arrière-plan ; il peut être nécessaire de
  désactiver l'optimisation de batterie pour l'application.
- **Alarmes exactes (Android 12+)** — l'application déclare
  `SCHEDULE_EXACT_ALARM`. Sans cette autorisation, `expo-notifications` bascule
  sur des alarmes *inexactes* et le système peut retarder les rappels de
  plusieurs minutes en veille. Sur Android 14+, l'autorisation n'est plus
  accordée d'office : si les rappels dérivent, activez « Alarmes et rappels »
  dans **Paramètres → Applications → Rappels**.
- Dans Expo Go, les notifications locales fonctionnent, mais une *development
  build* reste plus fidèle au comportement final.
