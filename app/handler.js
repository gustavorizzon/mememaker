'use strict'

const { exec } = require('child_process')
const { promises: { writeFile, readFile, unlink } } = require('fs')
const { promisify } = require('util')
const Joi = require('@hapi/joi')
const axios = require('axios')

const decoratorValidator = require('./utils/decoratorValidator')
const globalEnum = require('./utils/globalEnum')

const shell = promisify(exec)

class Handler {
	constructor() {}

	static validator() {
		return Joi.object({
			image: Joi.string().uri().required(),
			topText: Joi.string().max(200).required(),
			bottomText: Joi.string().max(200).optional()
		})
	}

	static generateImagePath() {
		return `/tmp/${new Date().getTime()}-out.png`
	}

	static async saveImageLocally(imageUrl, imagePath) {
		const { data } = await axios.get(imageUrl, { responseType: 'arraybuffer' })

		const buffer = Buffer.from(data, 'base64')

		return writeFile(imagePath, buffer)
	}

	static generateIdentifyCommand(imagePath) {
		const value = `
			gm identify \
			-verbose \
			${imagePath}
		`

		const cmd = value.split('\n').join(' ')

		return cmd
	}

	static async getImageSize(imagePath) {
		const command = Handler.generateIdentifyCommand(imagePath)

		const { stdout } = await shell(command)

		const [line] = stdout.trim().split('\n').filter(text => ~text.indexOf('Geometry'))

		const [width, height] = line.trim().replace('Geometry:', '').split('x')

		return {
			width: Number(width),
			height: Number(height)
		}
	}

	static setParameters(options, dimensions, imagePath) {
		return {
			topText: options.topText,
			bottomText: options.bottomText || "",
			font: __dirname + './resources/Outfit.ttf',
			fontSize: dimensions.width / 8,
			fontFill: '#fff',
			textPos: 'center',
			strokeColor: '#000',
			strokeWidth: 1,
			padding: 40,
			imagePath
		}
	}

	static setTextPosition(dimensions, padding) {
		const top = Math.abs((dimensions.height / 2.1) - padding) * -1
		const bottom = (dimensions.height / 2.1) - padding

		return {
			top,
			bottom
		}
	}

	static async generateConvertCommand(options, finalPath) {
		const value = `
			gm convert
			'${options.imagePath}'
			-font '${options.font}'
			-pointSize '${options.fontSize}'
			-fill '${options.fontFill}'
			-stroke '${options.strokeColor}'
			-strokewidth ${options.strokeWidth}
			-draw 'gravity ${options.textPos} text 0,${options.top} "${options.topText}"'
			-draw 'gravity ${options.textPos} text 0,${options.bottom} "${options.bottomText}"'
			${finalPath}
		`

		const final = value.split('\n').join(' ')

		return shell(final)
	}

	static async generateBase64(imagePath) {
		return readFile(imagePath, 'base64')
	}

	static async main(event) {
		try {
			const options = event.queryStringParameters

			const imagePath = Handler.generateImagePath()

			await Handler.saveImageLocally(options.image, imagePath)

			const dimensions = await Handler.getImageSize(imagePath)

			const params = Handler.setParameters(options, dimensions, imagePath)

			const { top, bottom }  = Handler.setTextPosition(dimensions, params.padding)

			const finalPath = Handler.generateImagePath()

			await Handler.generateConvertCommand({
				...params,
				top,
				bottom
			}, finalPath)

			const imageBuffer = await Handler.generateBase64(finalPath)

			await Promise.all([
				unlink(imagePath),
				unlink(finalPath)
			])

			return {
				statusCode: 200,
				headers: {
					'Content-Type': 'text/html'
				},
				body: `<img src="data:image/png;base64,${imageBuffer}" />`,
			}
		} catch (err) {
			console.log('Handler::Error::', err.stack)
			return {
				statusCode: 500,
				body: 'Internal server error'
			}
		}
	}
}

module.exports = {
	memeMaker: decoratorValidator(Handler.main, Handler.validator(), globalEnum.ARG_TYPE.QUERYSTRING)
}
