// Definition (re)builders mixed onto the instance — kept apart from helpers.js
// because they pull in actions/feedbacks/presets/variables, which themselves
// require helpers.
const { setActions } = require('./actions')
const { setFeedbacks } = require('./feedbacks')
const { setPresets } = require('./presets')
const { initVariables, updateVariables } = require('./variables')

const definitionMethods = {
	rebuildDefinitions() {
		initVariables(this)
		setActions(this)
		setFeedbacks(this)
		setPresets(this)
		updateVariables(this)
	},

	// Push live values + re-evaluate feedbacks (every poll).
	refreshValues() {
		updateVariables(this)
		this.checkFeedbacks()
	},
}

module.exports = { definitionMethods }
