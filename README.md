# PillTracker – Team Setup Guide

## Install dependencies (everyone runs this once)
```
npm install @react-navigation/native @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context
npm install firebase
npx expo install expo-notifications
```

---

## Git Branch Guide

### How to create your branch
```
git checkout main
git pull
git checkout -b your-branch-name
```



### How to push your work
```
git add .
git commit -m "describe what you did"
git push origin your-branch-name
```

### How to merge into main (do this when your feature is done)
```
git checkout main
git pull
git merge your-branch-name
git push
```

---


## Running the app
```
npx expo start
```
Then scan the QR code with the Expo Go app on your phone.