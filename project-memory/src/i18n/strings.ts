/**
 * Copy lives here, not in screens.
 *
 * Two reasons: Arabic is a first-class language for this product (not an
 * afterthought), and the emotional tone of the product is a design asset that
 * needs to be reviewed in one place rather than scattered across 20 files.
 */

export type Language = 'en' | 'ar';

export interface Strings {
  common: {
    appName: string;
    continue: string;
    back: string;
    next: string;
    skip: string;
    save: string;
    cancel: string;
    delete: string;
    done: string;
    retry: string;
    close: string;
    remove: string;
    optional: string;
    required: string;
    comingSoon: string;
    loading: string;
    somethingWentWrong: string;
  };
  onboarding: {
    slides: { title: string; body: string }[];
    start: string;
    haveAccount: string;
  };
  auth: {
    signInTitle: string;
    signInSubtitle: string;
    signUpTitle: string;
    signUpSubtitle: string;
    email: string;
    password: string;
    displayName: string;
    familyName: string;
    familyNameHint: string;
    signIn: string;
    signUp: string;
    createAccount: string;
    noAccount: string;
    hasAccount: string;
    continueWithApple: string;
    continueWithGoogle: string;
    socialUnavailable: string;
    passwordHint: string;
    privacyNote: string;
  };
  family: {
    title: string;
    subtitle: string;
    addChild: string;
    emptyTitle: string;
    emptyBody: string;
    memoryCountOne: string;
    memoryCountTwo: string;
    memoriesCount: string;
    memoriesCountMany: string;
  };
  child: {
    newTitle: string;
    newSubtitle: string;
    firstName: string;
    nickname: string;
    dateOfBirth: string;
    photo: string;
    choosePhoto: string;
    changePhoto: string;
    create: string;
    privacyNote: string;
    timeline: string;
    upcoming: string;
    turning: string;
    addMemory: string;
    emptyTimelineTitle: string;
    emptyTimelineBody: string;
    born: string;
    ageYearOne: string;
    ageYearTwo: string;
    ageYears: string;
    ageYearsMany: string;
    ageMonthOne: string;
    ageMonthTwo: string;
    ageMonths: string;
    ageMonthsMany: string;
    newborn: string;
    deleteChild: string;
    deleteChildConfirm: string;
  };
  memory: {
    newTitle: string;
    kindQuestion: string;
    detailsTitle: string;
    titleLabel: string;
    titlePlaceholder: string;
    dateLabel: string;
    noteLabel: string;
    notePlaceholder: string;
    futureMessageLabel: string;
    futureMessageHint: string;
    futureMessagePlaceholder: string;
    photosLabel: string;
    photosHint: string;
    addPhoto: string;
    saveMemory: string;
    savedToTimeline: string;
    archiveTitle: string;
    archiveSubtitle: string;
    archiveEmpty: string;
  };
  photoQuality: {
    title: string;
    analysing: string;
    overall: string;
    face: string;
    body: string;
    lighting: string;
    background: string;
    sharpness: string;
    framing: string;
    people: string;
    verdictExcellent: string;
    verdictGood: string;
    verdictFair: string;
    verdictPoor: string;
    advice: string;
    checkedOnDevice: string;
    estimateNote: string;
  };
  threeD: {
    entryTitle: string;
    entryBody: string;
    create: string;
    needPhoto: string;
    stages: string[];
    inProgressTitle: string;
    doneTitle: string;
    doneBody: string;
    failedTitle: string;
    failedBody: string;
    tryAgain: string;
    preview: string;
    previewHint: string;
    saveToTimeline: string;
    demoBadge: string;
    demoExplainer: string;
    sourcePhotos: string;
    qualityGateTitle: string;
    qualityGateBody: string;
    continueAnyway: string;
    chooseBetterPhoto: string;
  };
  settings: {
    title: string;
    account: string;
    language: string;
    appearance: string;
    appearanceSystem: string;
    appearanceLight: string;
    appearanceDark: string;
    privacy: string;
    privacyTitle: string;
    occasions: string;
    occasionsHint: string;
    plans: string;
    plansHint: string;
    admin: string;
    signOut: string;
    deleteAccount: string;
    deleteAccountConfirm: string;
    aboutData: string;
    version: string;
    backendMode: string;
  };
  privacy: {
    heading: string;
    points: { title: string; body: string }[];
    exportData: string;
    exportSaved: string;
    exportUnavailable: string;
    deleteEverything: string;
    deleteEverythingConfirm: string;
    trainingOptInTitle: string;
    trainingOptInBody: string;
  };
  plans: {
    title: string;
    subtitle: string;
    notice: string;
    activeNow: string;
    perYear: string;
    oneOff: string;
    tiers: { key: string; name: string; price: string; blurb: string; features: string[] }[];
  };
  admin: {
    title: string;
    subtitle: string;
    overview: string;
    jobs: string;
    qaQueue: string;
    failures: string;
    costs: string;
    noJobs: string;
    approve: string;
    regenerate: string;
    adjust: string;
    reject: string;
    reviewSaved: string;
    families: string;
    children: string;
    memories: string;
    totalSpend: string;
  };
  future: {
    storyTitle: string;
    storyBody: string;
    capsuleTitle: string;
    capsuleBody: string;
    remindersTitle: string;
    remindersBody: string;
  };
  errors: {
    genericTitle: string;
    generic: string;
    network: string;
    auth: string;
    upload: string;
    generation: string;
    notFound: string;
    invalidEmail: string;
    weakPassword: string;
    nameRequired: string;
    dobRequired: string;
    dobFuture: string;
    storageUnavailable: string;
    titleRequired: string;
  };
}

export const en: Strings = {
  common: {
    appName: 'Project Memory',
    continue: 'Continue',
    back: 'Back',
    next: 'Next',
    skip: 'Skip',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    done: 'Done',
    retry: 'Try again',
    close: 'Close',
    remove: 'Remove',
    optional: 'Optional',
    required: 'Required',
    comingSoon: 'Coming soon',
    loading: 'One moment…',
    somethingWentWrong: 'Something went wrong',
  },
  onboarding: {
    slides: [
      { title: 'Some moments happen only once.', body: 'A first word. A first step. The way they laughed this morning.' },
      { title: 'Keep every chapter of their childhood.', body: 'One private place that grows with your child, year after year.' },
      { title: 'Photos. Stories. Messages. Memories you can hold.', body: 'Turn a favourite photo into a keepsake they will still have when they are grown.' },
      { title: 'Start their story.', body: 'It takes a minute today. It will matter for a lifetime.' },
    ],
    start: 'Start their story',
    haveAccount: 'I already have an account',
  },
  auth: {
    signInTitle: 'Welcome back',
    signInSubtitle: 'Your family is waiting.',
    signUpTitle: 'Create your family account',
    signUpSubtitle: 'This is where their story lives.',
    email: 'Email',
    password: 'Password',
    displayName: 'Your name',
    familyName: 'Family name',
    familyNameHint: 'What should we call your family? You can change this later.',
    signIn: 'Sign in',
    signUp: 'Create account',
    createAccount: 'Create account',
    noAccount: 'New here? Create an account',
    hasAccount: 'Already have an account? Sign in',
    continueWithApple: 'Continue with Apple',
    continueWithGoogle: 'Continue with Google',
    socialUnavailable: 'Apple and Google sign-in are being set up. Please use your email for now.',
    passwordHint: 'At least 8 characters.',
    privacyNote: 'Your family’s photos are private by default. Only people you invite can ever see them.',
  },
  family: {
    title: 'Your family',
    subtitle: 'Every child has their own story.',
    addChild: 'Add a child',
    emptyTitle: 'Your family starts here',
    emptyBody: 'Add your first child and begin the archive they will one day read.',
    memoryCountOne: '1 memory',
    memoryCountTwo: '2 memories',
    memoriesCount: '{count} memories',
    memoriesCountMany: '{count} memories',
  },
  child: {
    newTitle: 'Add a child',
    newSubtitle: 'Just the essentials. You can add more whenever you like.',
    firstName: 'First name',
    nickname: 'Nickname',
    dateOfBirth: 'Date of birth',
    photo: 'Photo',
    choosePhoto: 'Choose a photo',
    changePhoto: 'Change photo',
    create: 'Create profile',
    privacyNote: 'We ask for as little as possible. No surname, no address, nothing we do not need.',
    timeline: 'Timeline',
    upcoming: 'Coming up',
    turning: 'Turning {count}',
    addMemory: 'Add a memory',
    emptyTimelineTitle: 'The first page is empty',
    emptyTimelineBody: 'Add a memory — a photo, a few words, a message for later.',
    born: 'Born {date}',
    ageYearOne: '1 year old',
    ageYearTwo: '2 years old',
    ageYears: '{count} years old',
    ageYearsMany: '{count} years old',
    ageMonthOne: '1 month old',
    ageMonthTwo: '2 months old',
    ageMonths: '{count} months old',
    ageMonthsMany: '{count} months old',
    newborn: 'Newborn',
    deleteChild: 'Delete this profile',
    deleteChildConfirm: 'This permanently removes {name}’s profile, memories and photos. This cannot be undone.',
  },
  memory: {
    newTitle: 'Add a memory',
    kindQuestion: 'What would you like to remember?',
    detailsTitle: 'Tell the story',
    titleLabel: 'Title',
    titlePlaceholder: 'Her first day at school',
    dateLabel: 'When did this happen?',
    noteLabel: 'A few words',
    notePlaceholder: 'What happened? What do you want to remember about today?',
    futureMessageLabel: 'A message for later',
    futureMessageHint: 'Kept for your child to read when they are older.',
    futureMessagePlaceholder: 'One day you will read this…',
    photosLabel: 'Photos',
    photosHint: 'Up to 5 photos. Add a few angles if you would like a figurine later.',
    addPhoto: 'Add photo',
    saveMemory: 'Save memory',
    savedToTimeline: 'Saved to the timeline',
    archiveTitle: 'Archive',
    archiveSubtitle: 'Everything you have kept, in one place.',
    archiveEmpty: 'Memories you add will gather here.',
  },
  photoQuality: {
    title: 'Photo quality',
    analysing: 'Looking at your photo…',
    overall: 'Overall',
    face: 'Face',
    body: 'Body',
    lighting: 'Lighting',
    background: 'Background',
    sharpness: 'Sharpness',
    framing: 'Framing',
    people: 'People in frame',
    verdictExcellent: 'Excellent',
    verdictGood: 'Good',
    verdictFair: 'Fair',
    verdictPoor: 'Difficult',
    advice: 'What this means',
    checkedOnDevice: 'Checked on your phone. The photo has not left your device yet.',
    estimateNote: 'An early check, based on the photo’s size and detail. A closer look at faces and bodies is on the way.',
  },
  threeD: {
    entryTitle: 'A memory you can hold',
    entryBody: 'Turn these photos into a small figurine of your child.',
    create: 'Create 3D memory',
    needPhoto: 'Add at least one photo first.',
    stages: [
      'Preparing your memory',
      'Understanding the photo',
      'Building the 3D form',
      'Refining the details',
      'Preparing your preview',
    ],
    inProgressTitle: 'Creating your memory',
    doneTitle: 'Your memory is ready',
    doneBody: 'Have a look. When you are happy with it, keep it on the timeline.',
    failedTitle: 'We couldn’t finish this one yet',
    failedBody: 'Your photos are safe. Nothing was lost — you can try again whenever you like.',
    tryAgain: 'Try again',
    preview: 'Preview',
    previewHint: 'Drag to turn it around.',
    saveToTimeline: 'Keep on the timeline',
    demoBadge: 'Demo preview',
    demoExplainer: 'This is a demonstration figurine. Real 3D generation switches on once a provider is connected — the memory and photos are real and stay saved either way.',
    sourcePhotos: 'Photos used',
    qualityGateTitle: 'This photo may be difficult',
    qualityGateBody: 'A clearer, full-body photo usually gives a much better figurine. You can continue anyway.',
    continueAnyway: 'Continue anyway',
    chooseBetterPhoto: 'Choose another photo',
  },
  settings: {
    title: 'Settings',
    account: 'Account',
    language: 'Language',
    appearance: 'Appearance',
    appearanceSystem: 'Match my phone',
    appearanceLight: 'Light',
    appearanceDark: 'Dark',
    privacy: 'Privacy',
    privacyTitle: 'Privacy & your data',
    occasions: 'Occasions we remember',
    occasionsHint: 'Choose the days that matter to your family.',
    plans: 'Memory plans',
    plansHint: 'Nothing to pay today.',
    admin: 'Admin',
    signOut: 'Sign out',
    deleteAccount: 'Delete my account',
    deleteAccountConfirm: 'This permanently deletes your family, every child profile, every memory and every photo. This cannot be undone.',
    aboutData: 'About your data',
    version: 'Version',
    backendMode: 'Storage',
  },
  privacy: {
    heading: 'Your family’s photos belong to your family.',
    points: [
      { title: 'Private by default', body: 'Child profiles are visible only to your family account. There is no public feed, no sharing by default and no public storage.' },
      { title: 'We ask for very little', body: 'A first name and a date of birth. No surname, no address, no school, no location.' },
      { title: 'Photos are stored privately', body: 'Files live in a private folder scoped to your family. Access is checked on every request, and links to your photos expire.' },
      { title: 'You can delete everything', body: 'Delete a single photo, a whole child profile, or your entire account. Deletion removes the files, not just the row in a table.' },
      { title: 'We do not train AI on your children', body: 'Your photos are never used to train models. They are sent to a 3D provider only when you ask for a figurine, and only for that request.' },
    ],
    exportData: 'Save a copy of my data',
    exportSaved: 'Saved to this phone: {children} children and {memories} memories, at {path}.',
    exportUnavailable:
      'We gathered your copy — {children} children and {memories} memories — but this browser will not let us save a file. Open Project Memory on your phone to keep a copy.',
    deleteEverything: 'Delete everything',
    deleteEverythingConfirm: 'This permanently deletes every child, memory and photo in your family account.',
    trainingOptInTitle: 'Help improve our models',
    trainingOptInBody: 'Off by default. If you ever turn this on, we may use your figurine results — never your child’s photographs — to improve quality.',
  },
  plans: {
    title: 'Memory plans',
    subtitle: 'Everything in Project Memory works today without a plan.',
    notice: 'Pricing is a preview. Nothing is charged and no payment details are collected.',
    activeNow: 'Your plan',
    perYear: 'per year',
    oneOff: 'one-off',
    tiers: [
      { key: 'free', name: 'Free', price: '0', blurb: 'The archive, always.', features: ['Unlimited children', 'Unlimited memories', 'Photo storage', 'Private by default'] },
      { key: 'memory', name: 'Memory', price: '—', blurb: 'One keepsake a year.', features: ['Everything in Free', 'One printed figurine', 'Priority 3D generation'] },
      { key: 'family', name: 'Family', price: '—', blurb: 'For growing families.', features: ['Everything in Memory', 'Several keepsakes a year', 'Personalised story book'] },
      { key: 'legacy', name: 'Legacy', price: '—', blurb: 'The twenty-year archive.', features: ['Everything in Family', 'Long-term archive guarantee', 'Time capsule messages'] },
    ],
  },
  admin: {
    title: 'Admin',
    subtitle: 'Internal tools. Not visible to families.',
    overview: 'Overview',
    jobs: '3D jobs',
    qaQueue: 'QA queue',
    failures: 'Failed jobs',
    costs: 'Provider costs',
    noJobs: 'No jobs yet.',
    approve: 'Approve',
    regenerate: 'Needs regeneration',
    adjust: 'Needs manual adjustment',
    reject: 'Reject',
    reviewSaved: 'Review saved',
    families: 'Families',
    children: 'Children',
    memories: 'Memories',
    totalSpend: 'Estimated spend',
  },
  future: {
    storyTitle: 'A story written for them',
    storyBody: 'Tell us what your child loves and we will write and illustrate their own picture book.',
    capsuleTitle: 'Time capsule',
    capsuleBody: 'Leave messages your child will open years from now.',
    remindersTitle: 'Memory calendar',
    remindersBody: 'Gentle reminders on the days your family celebrates.',
  },
  errors: {
    genericTitle: 'That didn’t work',
    generic: 'Something went wrong on our side. Your memories are safe — please try again.',
    network: 'We can’t reach the internet right now. Your work is saved on this phone.',
    auth: 'That email and password don’t match. Please check and try again.',
    upload: 'We couldn’t add that photo. Please try again.',
    generation: 'We couldn’t finish this memory yet. Your photos are safe — try again.',
    notFound: 'We couldn’t find that.',
    invalidEmail: 'Please enter a valid email address.',
    weakPassword: 'Please use at least 8 characters.',
    nameRequired: 'Please enter a first name.',
    dobRequired: 'Please choose a date of birth.',
    dobFuture: 'That date is in the future.',
    storageUnavailable:
      'This browser will not let us save to your device. You can look around, but anything you add will be gone when you close this page.',
    titleRequired: 'Please give this memory a title.',
  },
};
