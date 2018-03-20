import { AnimationAction } from '../../src/animation/AnimationAction';
import { AnimationMixer } from '../../src/animation/AnimationMixer';
import { AnimationClip } from '../../src/animation/AnimationClip';
// import { NumberKeyframeTrack } from '../../../../src/animation/tracks/NumberKeyframeTrack';
// import { Object3D } from '../../../../src/core/Object3D';
// import { LoopOnce, LoopRepeat, LoopPingPong } from '../../../../src/constants';
import { FileLoader } from '../../src/loaders/FileLoader'
export default QUnit.module('Constants', () => {

	QUnit.test("test", (assert) => {
		assert.ok(true)


	});
	QUnit.test("Instancing", (assert) => {

		var mixer = new AnimationMixer();
		var clip = new AnimationClip("nonname", - 1, []);

		var animationAction = new AnimationAction(mixer, clip);
		assert.ok(animationAction, "animationAction instanciated");

	});
	QUnit.test('FileLoader', (assert) => {
		var loader = new FileLoader()
		assert.ok(loader);
		loader.load(
			// resource URL
			'example.txt',

			// onLoad callback
			function (data) {
				// output the text to the console
				console.log(data)
			},

			// onProgress callback
			function (xhr) {
				console.log((xhr.loaded / xhr.total * 100) + '% loaded');
			},

			// onError callback
			function (err) {
				console.error('An error happened');
			}
		);
	})
});