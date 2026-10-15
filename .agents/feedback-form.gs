/**
 * Together Photobooth — soft-launch feedback form.
 * Paste into https://script.google.com (New project), then click Run.
 * It creates a Google Form in your Drive and prints its links in the log.
 */
function createFeedbackForm() {
  const form = FormApp.create('Together Photobooth — Feedback');
  form.setDescription(
    'Thank you for trying Together Photobooth! 💛\n' +
    'This takes about 3 minutes. Please be honest — bad feedback helps the most.'
  );

  // ---------- Section 1: About you (who used it, and how) ----------
  form.addMultipleChoiceItem()
    .setTitle('Which booth did you try?')
    .setChoiceValues(['Solo', 'Duo', 'Both'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Who did you use it with?')
    .setChoiceValues(['Partner', 'Friend', 'Family', 'Alone'])
    .showOtherOption(true)
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('What device did you use?')
    .setChoiceValues(['Phone', 'Tablet', 'Computer / laptop'])
    .setRequired(true);

  // ---------- Section 2: Experience (did it work, was it nice) ----------
  form.addPageBreakItem().setTitle('Your experience');

  form.addScaleItem()
    .setTitle('Overall, how much did you enjoy it?')
    .setBounds(1, 5)
    .setLabels('Not at all', 'Loved it')
    .setRequired(true);

  form.addScaleItem()
    .setTitle('How easy was it to use?')
    .setBounds(1, 5)
    .setLabels('Very confusing', 'Very easy')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Did the camera (and Duo connection) work?')
    .setChoiceValues(['Yes, no problems', 'Some problems', 'It didn’t work'])
    .setRequired(true);

  form.addScaleItem()
    .setTitle('How happy were you with the photo quality of your photocard?')
    .setBounds(1, 5)
    .setLabels('Not happy', 'Very happy')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('What did you like most?');

  form.addParagraphTextItem()
    .setTitle('What was confusing, slow or annoying?');

  // ---------- Section 3: Value (would they pay, and how much) ----------
  form.addPageBreakItem().setTitle('Would you use it again?');

  form.addMultipleChoiceItem()
    .setTitle('Would you use Together Photobooth again?')
    .setChoiceValues(['Yes, definitely', 'Maybe', 'No'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('What price per session feels fair to you?')
    .setChoiceValues([
      'I would only use it if it’s free',
      'Up to 2,000 MMK',
      '3,000 – 4,000 MMK',
      '5,000 – 7,000 MMK',
      'More than 7,000 MMK',
    ])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('What would make it more worth paying for? (choose any)')
    .setChoiceValues([
      'More frame designs',
      'Frames for special days (anniversary, birthday, holidays)',
      'Better photo quality',
      'A printed card delivered to me',
      'Cheaper bundles (e.g. 3 sessions)',
    ])
    .showOtherOption(true);

  form.addScaleItem()
    .setTitle('How likely are you to recommend it to a friend?')
    .setBounds(0, 10)
    .setLabels('Not likely', 'Very likely')
    .setRequired(true);

  // ---------- Section 4: Review (for social proof on TikTok/Facebook) ----------
  form.addPageBreakItem().setTitle('A little review (optional)');

  form.addParagraphTextItem()
    .setTitle('In one or two sentences, how would you describe Together Photobooth to a friend?');

  form.addMultipleChoiceItem()
    .setTitle('Can we share your review (and photocard, if you send it) on our TikTok / Facebook?')
    .setChoiceValues(['Yes, with my name', 'Yes, but anonymous', 'No, please keep it private'])
    .setRequired(true);

  form.addTextItem()
    .setTitle('Your name or Telegram username (optional, only if you’re happy for us to follow up)');

  // Print both links: one to share, one to edit.
  Logger.log('Share this link: ' + form.getPublishedUrl());
  Logger.log('Edit the form:   ' + form.getEditUrl());
}
