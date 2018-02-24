(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory() :
		typeof define === 'function' && define.amd ? define(factory) :
			(factory());
}(this, (function () {
	'use strict';

	QUnit.module("Example", () => {

		/**
		 * @author fernandojsg / http://fernandojsg.com
		 */

		//------------------------------------------------------------------------------
		// Constants
		//------------------------------------------------------------------------------
		var WEBGL_CONSTANTS = {
			POINTS: 0x0000,
			LINES: 0x0001,
			LINE_LOOP: 0x0002,
			LINE_STRIP: 0x0003,
			TRIANGLES: 0x0004,
			TRIANGLE_STRIP: 0x0005,
			TRIANGLE_FAN: 0x0006,

			UNSIGNED_BYTE: 0x1401,
			UNSIGNED_SHORT: 0x1403,
			FLOAT: 0x1406,
			UNSIGNED_INT: 0x1405,
			ARRAY_BUFFER: 0x8892,
			ELEMENT_ARRAY_BUFFER: 0x8893,

			NEAREST: 0x2600,
			LINEAR: 0x2601,
			NEAREST_MIPMAP_NEAREST: 0x2700,
			LINEAR_MIPMAP_NEAREST: 0x2701,
			NEAREST_MIPMAP_LINEAR: 0x2702,
			LINEAR_MIPMAP_LINEAR: 0x2703
		};

		var THREE_TO_WEBGL = {
			// @TODO Replace with computed property name [THREE.*] when available on es6
			1003: WEBGL_CONSTANTS.NEAREST,
			1004: WEBGL_CONSTANTS.NEAREST_MIPMAP_NEAREST,
			1005: WEBGL_CONSTANTS.NEAREST_MIPMAP_LINEAR,
			1006: WEBGL_CONSTANTS.LINEAR,
			1007: WEBGL_CONSTANTS.LINEAR_MIPMAP_NEAREST,
			1008: WEBGL_CONSTANTS.LINEAR_MIPMAP_LINEAR
		};

		var PATH_PROPERTIES = {
			scale: 'scale',
			position: 'translation',
			quaternion: 'rotation',
			morphTargetInfluences: 'weights'
		};

		//------------------------------------------------------------------------------
		// GLTF Exporter
		//------------------------------------------------------------------------------
		THREE.GLTFExporter = function () { };

		THREE.GLTFExporter.prototype = {

			constructor: THREE.GLTFExporter,

			/**
			 * Parse scenes and generate GLTF output
			 * @param  {THREE.Scene or [THREE.Scenes]} input   THREE.Scene or Array of THREE.Scenes
			 * @param  {Function} onDone  Callback on completed
			 * @param  {Object} options options
			 */
			parse: function (input, onDone, options) {

				var DEFAULT_OPTIONS = {
					trs: false,
					onlyVisible: true,
					truncateDrawRange: true,
					embedImages: true,
					animations: [],
					forceIndices: false
				};

				options = Object.assign({}, DEFAULT_OPTIONS, options);

				if (options.animations.length > 0) {

					// Only TRS properties, and not matrices, may be targeted by animation.
					options.trs = true;

				}

				var outputJSON = {

					asset: {

						version: "2.0",
						generator: "THREE.GLTFExporter"

					}

				};

				var byteOffset = 0;
				var dataViews = [];
				var nodeMap = {};
				var skins = [];
				var cachedData = {

					materials: {},
					textures: {}

				};

				var cachedCanvas;

				/**
				 * Compare two arrays
				 */
				/**
				 * Compare two arrays
				 * @param  {Array} array1 Array 1 to compare
				 * @param  {Array} array2 Array 2 to compare
				 * @return {Boolean}        Returns true if both arrays are equal
				 */
				function equalArray(array1, array2) {

					return (array1.length === array2.length) && array1.every(function (element, index) {

						return element === array2[index];

					});

				}

				/**
				 * Converts a string to an ArrayBuffer.
				 * @param  {string} text
				 * @return {ArrayBuffer}
				 */
				function stringToArrayBuffer(text, padded) {
					if (padded) {

						var pad = getPaddedBufferSize(text.length) - text.length;

						for (var i = 0; i < pad; i++) {

							text += ' ';

						}

					}

					if (window.TextEncoder !== undefined) {

						return new TextEncoder().encode(text).buffer;

					}

					var buffer = new ArrayBuffer(text.length);

					var bufferView = new Uint8Array(buffer);

					for (var i = 0; i < text.length; ++i) {

						bufferView[i] = text.charCodeAt(i);

					}

					return buffer;

				}

				/**
				 * Get the min and max vectors from the given attribute
				 * @param  {THREE.BufferAttribute} attribute Attribute to find the min/max
				 * @return {Object} Object containing the `min` and `max` values (As an array of attribute.itemSize components)
				 */
				function getMinMax(attribute) {

					var output = {

						min: new Array(attribute.itemSize).fill(Number.POSITIVE_INFINITY),
						max: new Array(attribute.itemSize).fill(Number.NEGATIVE_INFINITY)

					};

					for (var i = 0; i < attribute.count; i++) {

						for (var a = 0; a < attribute.itemSize; a++) {

							var value = attribute.array[i * attribute.itemSize + a];
							output.min[a] = Math.min(output.min[a], value);
							output.max[a] = Math.max(output.max[a], value);

						}

					}

					return output;

				}

				/**
				 * Get the required size + padding for a buffer, rounded to the next 4-byte boundary.
				 * https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#data-alignment
				 *
				 * @param {Integer} bufferSize The size the original buffer.
				 * @returns {Integer} new buffer size with required padding.
				 *
				 */
				function getPaddedBufferSize(bufferSize) {

					return Math.ceil(bufferSize / 4) * 4;

				}

				/**
				 * Returns a buffer aligned to 4-byte boundary. 
				 * 
				 * @param {ArrayBuffer} arrayBuffer Buffer to pad
				 * @returns {ArrayBuffer} The same buffer if it's already aligned to 4-byte boundary or a new buffer
				 */
				function getPaddedArrayBuffer(arrayBuffer) {

					var paddedLength = getPaddedBufferSize(arrayBuffer.byteLength);

					if (paddedLength !== arrayBuffer.byteLength) {

						var paddedBuffer = new ArrayBuffer(paddedLength);
						new Uint8Array(paddedBuffer).set(new Uint8Array(arrayBuffer));
						return paddedBuffer;

					}

					return arrayBuffer;

				}

				/**
				 * Process a buffer to append to the default one.
				 * @param  {THREE.BufferAttribute} attribute     Attribute to store
				 * @param  {Integer} componentType Component type (Unsigned short, unsigned int or float)
				 * @return {Integer}               Index of the buffer created (Currently always 0)
				 */
				function processBuffer(attribute, componentType, start, count) {

					if (!outputJSON.buffers) {

						outputJSON.buffers = [

							{

								byteLength: 0,
								uri: ''

							}

						];

					}

					var offset = 0;
					var componentSize = componentType === WEBGL_CONSTANTS.UNSIGNED_SHORT ? 2 : 4;

					// Create a new dataview and dump the attribute's array into it
					var byteLength = count * attribute.itemSize * componentSize;

					// adjust required size of array buffer with padding
					// to satisfy gltf requirement that the length is divisible by 4
					byteLength = getPaddedBufferSize(byteLength);

					var dataView = new DataView(new ArrayBuffer(byteLength));

					for (var i = start; i < start + count; i++) {

						for (var a = 0; a < attribute.itemSize; a++) {

							var value = attribute.array[i * attribute.itemSize + a];

							if (componentType === WEBGL_CONSTANTS.FLOAT) {

								dataView.setFloat32(offset, value, true);

							} else if (componentType === WEBGL_CONSTANTS.UNSIGNED_INT) {

								dataView.setUint32(offset, value, true);

							} else if (componentType === WEBGL_CONSTANTS.UNSIGNED_SHORT) {

								dataView.setUint16(offset, value, true);

							}

							offset += componentSize;

						}

					}

					// We just use one buffer
					dataViews.push(dataView);

					// Always using just one buffer
					return 0;

				}

				/**
				 * Process and generate a BufferView
				 * @param  {THREE.BufferAttribute} data
				 * @param  {number} componentType
				 * @param  {number} start
				 * @param  {number} count
				 * @param  {number} target (Optional) Target usage of the BufferView
				 * @return {Object}
				 */
				function processBufferView(data, componentType, start, count, target) {

					if (!outputJSON.bufferViews) {

						outputJSON.bufferViews = [];

					}

					var componentSize = componentType === WEBGL_CONSTANTS.UNSIGNED_SHORT ? 2 : 4;

					// Create a new dataview and dump the attribute's array into it
					var byteLength = count * data.itemSize * componentSize;

					var gltfBufferView = {

						buffer: processBuffer(data, componentType, start, count),
						byteOffset: byteOffset,
						byteLength: byteLength

					};

					if (target !== undefined) gltfBufferView.target = target;

					if (target === WEBGL_CONSTANTS.ARRAY_BUFFER) {

						// Only define byteStride for vertex attributes.
						gltfBufferView.byteStride = data.itemSize * componentSize;

					}

					byteOffset += byteLength;

					outputJSON.bufferViews.push(gltfBufferView);

					// @TODO Ideally we'll have just two bufferviews: 0 is for vertex attributes, 1 for indices
					var output = {

						id: outputJSON.bufferViews.length - 1,
						byteLength: 0

					};

					return output;

				}

				/**
				 * Process attribute to generate an accessor
				 * @param  {THREE.BufferAttribute} attribute Attribute to process
				 * @param  {THREE.BufferGeometry} geometry (Optional) Geometry used for truncated draw range
				 * @return {Integer}           Index of the processed accessor on the "accessors" array
				 */
				function processAccessor(attribute, geometry) {

					if (!outputJSON.accessors) {

						outputJSON.accessors = [];

					}

					var types = {

						1: 'SCALAR',
						2: 'VEC2',
						3: 'VEC3',
						4: 'VEC4',
						16: 'MAT4'

					};

					var componentType;

					// Detect the component type of the attribute array (float, uint or ushort)
					if (attribute.array.constructor === Float32Array) {

						componentType = WEBGL_CONSTANTS.FLOAT;

					} else if (attribute.array.constructor === Uint32Array) {

						componentType = WEBGL_CONSTANTS.UNSIGNED_INT;

					} else if (attribute.array.constructor === Uint16Array) {

						componentType = WEBGL_CONSTANTS.UNSIGNED_SHORT;

					} else {

						throw new Error('THREE.GLTFExporter: Unsupported bufferAttribute component type.');

					}

					var minMax = getMinMax(attribute);

					var start = 0;
					var count = attribute.count;

					// @TODO Indexed buffer geometry with drawRange not supported yet
					if (options.truncateDrawRange && geometry !== undefined && geometry.index === null) {

						start = geometry.drawRange.start;
						count = geometry.drawRange.count !== Infinity ? geometry.drawRange.count : attribute.count;

					}

					var bufferViewTarget;

					// If geometry isn't provided, don't infer the target usage of the bufferView. For
					// animation samplers, target must not be set.
					if (geometry !== undefined) {

						var isVertexAttributes = componentType === WEBGL_CONSTANTS.FLOAT;
						bufferViewTarget = isVertexAttributes ? WEBGL_CONSTANTS.ARRAY_BUFFER : WEBGL_CONSTANTS.ELEMENT_ARRAY_BUFFER;

					}

					var bufferView = processBufferView(attribute, componentType, start, count, bufferViewTarget);

					var gltfAccessor = {

						bufferView: bufferView.id,
						byteOffset: bufferView.byteOffset,
						componentType: componentType,
						count: count,
						max: minMax.max,
						min: minMax.min,
						type: types[attribute.itemSize]

					};

					outputJSON.accessors.push(gltfAccessor);

					return outputJSON.accessors.length - 1;

				}

				/**
				 * Process image
				 * @param  {Texture} map Texture to process
				 * @return {Integer}     Index of the processed texture in the "images" array
				 */
				function processImage(map) {

					// @TODO Cache

					if (!outputJSON.images) {

						outputJSON.images = [];

					}

					var mimeType = map.format === THREE.RGBAFormat ? 'image/png' : 'image/jpeg';
					var gltfImage = { mimeType: mimeType };

					if (options.embedImages) {

						var canvas = cachedCanvas = cachedCanvas || document.createElement('canvas');
						canvas.width = map.image.width;
						canvas.height = map.image.height;
						var ctx = canvas.getContext('2d');

						if (map.flipY === true) {

							ctx.translate(0, map.image.height);
							ctx.scale(1, - 1);

						}

						ctx.drawImage(map.image, 0, 0);

						// @TODO Embed in { bufferView } if options.binary set.

						gltfImage.uri = canvas.toDataURL(mimeType);

					} else {

						gltfImage.uri = map.image.src;

					}

					outputJSON.images.push(gltfImage);

					return outputJSON.images.length - 1;

				}

				/**
				 * Process sampler
				 * @param  {Texture} map Texture to process
				 * @return {Integer}     Index of the processed texture in the "samplers" array
				 */
				function processSampler(map) {

					if (!outputJSON.samplers) {

						outputJSON.samplers = [];

					}

					var gltfSampler = {

						magFilter: THREE_TO_WEBGL[map.magFilter],
						minFilter: THREE_TO_WEBGL[map.minFilter],
						wrapS: THREE_TO_WEBGL[map.wrapS],
						wrapT: THREE_TO_WEBGL[map.wrapT]

					};

					outputJSON.samplers.push(gltfSampler);

					return outputJSON.samplers.length - 1;

				}

				/**
				 * Process texture
				 * @param  {Texture} map Map to process
				 * @return {Integer}     Index of the processed texture in the "textures" array
				 */
				function processTexture(map) {

					if (cachedData.textures[map.uuid] !== undefined) {

						return cachedData.textures[map.uuid];

					}

					if (!outputJSON.textures) {

						outputJSON.textures = [];

					}

					var gltfTexture = {

						sampler: processSampler(map),
						source: processImage(map)

					};

					outputJSON.textures.push(gltfTexture);

					var index = outputJSON.textures.length - 1;
					cachedData.textures[map.uuid] = index;

					return index;

				}

				/**
				 * Process material
				 * @param  {THREE.Material} material Material to process
				 * @return {Integer}      Index of the processed material in the "materials" array
				 */
				function processMaterial(material) {

					if (cachedData.materials[material.uuid] !== undefined) {

						return cachedData.materials[material.uuid];

					}

					if (!outputJSON.materials) {

						outputJSON.materials = [];

					}

					if (material instanceof THREE.ShaderMaterial) {

						console.warn('GLTFExporter: THREE.ShaderMaterial not supported.');
						return null;

					}


					if (!(material instanceof THREE.MeshStandardMaterial)) {

						console.warn('GLTFExporter: Currently just THREE.StandardMaterial is supported. Material conversion may lose information.');

					}

					// @QUESTION Should we avoid including any attribute that has the default value?
					var gltfMaterial = {

						pbrMetallicRoughness: {}

					};

					// pbrMetallicRoughness.baseColorFactor
					var color = material.color.toArray().concat([material.opacity]);

					if (!equalArray(color, [1, 1, 1, 1])) {

						gltfMaterial.pbrMetallicRoughness.baseColorFactor = color;

					}

					if (material instanceof THREE.MeshStandardMaterial) {

						gltfMaterial.pbrMetallicRoughness.metallicFactor = material.metalness;
						gltfMaterial.pbrMetallicRoughness.roughnessFactor = material.roughness;

					} else {

						gltfMaterial.pbrMetallicRoughness.metallicFactor = 0.5;
						gltfMaterial.pbrMetallicRoughness.roughnessFactor = 0.5;

					}

					// pbrMetallicRoughness.metallicRoughnessTexture
					if (material.metalnessMap || material.roughnessMap) {

						if (material.metalnessMap === material.roughnessMap) {

							gltfMaterial.pbrMetallicRoughness.metallicRoughnessTexture = {

								index: processTexture(material.metalnessMap)

							};

						} else {

							console.warn('THREE.GLTFExporter: Ignoring metalnessMap and roughnessMap because they are not the same Texture.');

						}

					}

					// pbrMetallicRoughness.baseColorTexture
					if (material.map) {

						gltfMaterial.pbrMetallicRoughness.baseColorTexture = {

							index: processTexture(material.map)

						};

					}

					if (material instanceof THREE.MeshBasicMaterial ||
						material instanceof THREE.LineBasicMaterial ||
						material instanceof THREE.PointsMaterial) {

					} else {

						// emissiveFactor
						var emissive = material.emissive.clone().multiplyScalar(material.emissiveIntensity).toArray();

						if (!equalArray(emissive, [0, 0, 0])) {

							gltfMaterial.emissiveFactor = emissive;

						}

						// emissiveTexture
						if (material.emissiveMap) {

							gltfMaterial.emissiveTexture = {

								index: processTexture(material.emissiveMap)

							};

						}

					}

					// normalTexture
					if (material.normalMap) {

						gltfMaterial.normalTexture = {

							index: processTexture(material.normalMap)

						};

						if (material.normalScale.x !== - 1) {

							if (material.normalScale.x !== material.normalScale.y) {

								console.warn('THREE.GLTFExporter: Normal scale components are different, ignoring Y and exporting X.');

							}

							gltfMaterial.normalTexture.scale = material.normalScale.x;

						}

					}

					// occlusionTexture
					if (material.aoMap) {

						gltfMaterial.occlusionTexture = {

							index: processTexture(material.aoMap)

						};

						if (material.aoMapIntensity !== 1.0) {

							gltfMaterial.occlusionTexture.strength = material.aoMapIntensity;

						}

					}

					// alphaMode
					if (material.transparent || material.alphaTest > 0.0) {

						gltfMaterial.alphaMode = material.opacity < 1.0 ? 'BLEND' : 'MASK';

						// Write alphaCutoff if it's non-zero and different from the default (0.5).
						if (material.alphaTest > 0.0 && material.alphaTest !== 0.5) {

							gltfMaterial.alphaCutoff = material.alphaTest;

						}

					}

					// doubleSided
					if (material.side === THREE.DoubleSide) {

						gltfMaterial.doubleSided = true;

					}

					if (material.name) {

						gltfMaterial.name = material.name;

					}

					outputJSON.materials.push(gltfMaterial);

					var index = outputJSON.materials.length - 1;
					cachedData.materials[material.uuid] = index;

					return index;

				}

				/**
				 * Process mesh
				 * @param  {THREE.Mesh} mesh Mesh to process
				 * @return {Integer}      Index of the processed mesh in the "meshes" array
				 */
				function processMesh(mesh) {

					if (!outputJSON.meshes) {

						outputJSON.meshes = [];

					}

					var geometry = mesh.geometry;

					var mode;

					// Use the correct mode
					if (mesh instanceof THREE.LineSegments) {

						mode = WEBGL_CONSTANTS.LINES;

					} else if (mesh instanceof THREE.LineLoop) {

						mode = WEBGL_CONSTANTS.LINE_LOOP;

					} else if (mesh instanceof THREE.Line) {

						mode = WEBGL_CONSTANTS.LINE_STRIP;

					} else if (mesh instanceof THREE.Points) {

						mode = WEBGL_CONSTANTS.POINTS;

					} else {

						if (!geometry.isBufferGeometry) {

							var geometryTemp = new THREE.BufferGeometry();
							geometryTemp.fromGeometry(geometry);
							geometry = geometryTemp;

						}

						if (mesh.drawMode === THREE.TriangleFanDrawMode) {

							console.warn('GLTFExporter: TriangleFanDrawMode and wireframe incompatible.');
							mode = WEBGL_CONSTANTS.TRIANGLE_FAN;

						} else if (mesh.drawMode === THREE.TriangleStripDrawMode) {

							mode = mesh.material.wireframe ? WEBGL_CONSTANTS.LINE_STRIP : WEBGL_CONSTANTS.TRIANGLE_STRIP;

						} else {

							mode = mesh.material.wireframe ? WEBGL_CONSTANTS.LINES : WEBGL_CONSTANTS.TRIANGLES;

						}

					}

					var gltfMesh = {
						primitives: [
							{
								mode: mode,
								attributes: {},
							}
						]
					};

					var material = processMaterial(mesh.material);
					if (material !== null) {

						gltfMesh.primitives[0].material = material;

					}


					if (geometry.index) {

						gltfMesh.primitives[0].indices = processAccessor(geometry.index, geometry);

					} else if (options.forceIndices) {

						var numFaces = geometry.attributes.position.count;
						var indices = new Uint32Array(numFaces);
						for (var i = 0; i < numFaces; i++) {

							indices[i] = i;

						}

						gltfMesh.primitives[0].indices = processAccessor(new THREE.Uint32BufferAttribute(indices, 1), geometry);

					}

					// We've just one primitive per mesh
					var gltfAttributes = gltfMesh.primitives[0].attributes;

					// Conversion between attributes names in threejs and gltf spec
					var nameConversion = {

						uv: 'TEXCOORD_0',
						uv2: 'TEXCOORD_1',
						color: 'COLOR_0',
						skinWeight: 'WEIGHTS_0',
						skinIndex: 'JOINTS_0'

					};

					// @QUESTION Detect if .vertexColors = THREE.VertexColors?
					// For every attribute create an accessor
					for (var attributeName in geometry.attributes) {

						var attribute = geometry.attributes[attributeName];
						attributeName = nameConversion[attributeName] || attributeName.toUpperCase();

						if (attributeName.substr(0, 5) !== 'MORPH') {

							gltfAttributes[attributeName] = processAccessor(attribute, geometry);

						}

					}

					// Morph targets
					if (mesh.morphTargetInfluences !== undefined && mesh.morphTargetInfluences.length > 0) {

						var weights = [];
						var targetNames = [];
						var reverseDictionary = {};

						if (mesh.morphTargetDictionary !== undefined) {

							for (var key in mesh.morphTargetDictionary) {

								reverseDictionary[mesh.morphTargetDictionary[key]] = key;

							}

						}

						gltfMesh.primitives[0].targets = [];

						for (var i = 0; i < mesh.morphTargetInfluences.length; ++i) {

							var target = {};

							var warned = false;

							for (var attributeName in geometry.morphAttributes) {

								// glTF 2.0 morph supports only POSITION/NORMAL/TANGENT.
								// Three.js doesn't support TANGENT yet.

								if (attributeName !== 'position' && attributeName !== 'normal') {

									if (!warned) {

										console.warn('GLTFExporter: Only POSITION and NORMAL morph are supported.');
										warned = true;

									}

									continue;

								}

								var attribute = geometry.morphAttributes[attributeName][i];

								// Three.js morph attribute has absolute values while the one of glTF has relative values.
								//
								// glTF 2.0 Specification:
								// https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#morph-targets

								var baseAttribute = geometry.attributes[attributeName];
								// Clones attribute not to override
								var relativeAttribute = attribute.clone();

								for (var j = 0, jl = attribute.count; j < jl; j++) {

									relativeAttribute.setXYZ(
										j,
										attribute.getX(j) - baseAttribute.getX(j),
										attribute.getY(j) - baseAttribute.getY(j),
										attribute.getZ(j) - baseAttribute.getZ(j)
									);

								}

								target[attributeName.toUpperCase()] = processAccessor(relativeAttribute, geometry);

							}

							gltfMesh.primitives[0].targets.push(target);

							weights.push(mesh.morphTargetInfluences[i]);
							if (mesh.morphTargetDictionary !== undefined) targetNames.push(reverseDictionary[i]);

						}

						gltfMesh.weights = weights;

						if (targetNames.length > 0) {

							gltfMesh.extras = {};
							gltfMesh.extras.targetNames = targetNames;

						}

					}

					outputJSON.meshes.push(gltfMesh);

					return outputJSON.meshes.length - 1;

				}

				/**
				 * Process camera
				 * @param  {THREE.Camera} camera Camera to process
				 * @return {Integer}      Index of the processed mesh in the "camera" array
				 */
				function processCamera(camera) {

					if (!outputJSON.cameras) {

						outputJSON.cameras = [];

					}

					var isOrtho = camera instanceof THREE.OrthographicCamera;

					var gltfCamera = {

						type: isOrtho ? 'orthographic' : 'perspective'

					};

					if (isOrtho) {

						gltfCamera.orthographic = {

							xmag: camera.right * 2,
							ymag: camera.top * 2,
							zfar: camera.far <= 0 ? 0.001 : camera.far,
							znear: camera.near < 0 ? 0 : camera.near

						};

					} else {

						gltfCamera.perspective = {

							aspectRatio: camera.aspect,
							yfov: THREE.Math.degToRad(camera.fov) / camera.aspect,
							zfar: camera.far <= 0 ? 0.001 : camera.far,
							znear: camera.near < 0 ? 0 : camera.near

						};

					}

					if (camera.name) {

						gltfCamera.name = camera.type;

					}

					outputJSON.cameras.push(gltfCamera);

					return outputJSON.cameras.length - 1;

				}

				/**
				 * Creates glTF animation entry from AnimationClip object.
				 *
				 * Status:
				 * - Only properties listed in PATH_PROPERTIES may be animated.
				 *
				 * @param {THREE.AnimationClip} clip
				 * @param {THREE.Object3D} root
				 * @return {number}
				 */
				function processAnimation(clip, root) {

					if (!outputJSON.animations) {

						outputJSON.animations = [];

					}

					var channels = [];
					var samplers = [];

					for (var i = 0; i < clip.tracks.length; ++i) {

						var track = clip.tracks[i];
						var trackBinding = THREE.PropertyBinding.parseTrackName(track.name);
						var trackNode = THREE.PropertyBinding.findNode(root, trackBinding.nodeName);
						var trackProperty = PATH_PROPERTIES[trackBinding.propertyName];

						if (trackBinding.objectName === 'bones') {

							if (trackNode.isSkinnedMesh === true) {

								trackNode = trackNode.skeleton.getBoneByName(trackBinding.objectIndex);

							} else {

								trackNode = undefined;

							}

						}

						if (!trackNode || !trackProperty) {

							console.warn('THREE.GLTFExporter: Could not export animation track "%s".', track.name);
							return null;

						}

						var inputItemSize = 1;
						var outputItemSize = track.values.length / track.times.length;

						if (trackProperty === PATH_PROPERTIES.morphTargetInfluences) {

							outputItemSize /= trackNode.morphTargetInfluences.length;

						}

						var interpolation;

						// @TODO export CubicInterpolant(InterpolateSmooth) as CUBICSPLINE

						// Detecting glTF cubic spline interpolant by checking factory method's special property
						// GLTFCubicSplineInterpolant is a custom interpolant and track doesn't return
						// valid value from .getInterpolation().
						if (track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline === true) {

							interpolation = 'CUBICSPLINE';

							// itemSize of CUBICSPLINE keyframe is 9
							// (VEC3 * 3: inTangent, splineVertex, and outTangent)
							// but needs to be stored as VEC3 so dividing by 3 here.
							outputItemSize /= 3;

						} else if (track.getInterpolation() === THREE.InterpolateDiscrete) {

							interpolation = 'STEP';

						} else {

							interpolation = 'LINEAR';

						}

						samplers.push({

							input: processAccessor(new THREE.BufferAttribute(track.times, inputItemSize)),
							output: processAccessor(new THREE.BufferAttribute(track.values, outputItemSize)),
							interpolation: interpolation

						});

						channels.push({

							sampler: samplers.length - 1,
							target: {
								node: nodeMap[trackNode.uuid],
								path: trackProperty
							}

						});

					}

					outputJSON.animations.push({

						name: clip.name || 'clip_' + outputJSON.animations.length,
						samplers: samplers,
						channels: channels

					});

					return outputJSON.animations.length - 1;

				}

				function processSkin(object) {

					var node = outputJSON.nodes[nodeMap[object.uuid]];

					var skeleton = object.skeleton;
					var rootJoint = object.skeleton.bones[0];

					if (rootJoint === undefined) return null;

					var joints = [];
					var inverseBindMatrices = new Float32Array(skeleton.bones.length * 16);

					for (var i = 0; i < skeleton.bones.length; ++i) {

						joints.push(nodeMap[skeleton.bones[i].uuid]);

						skeleton.boneInverses[i].toArray(inverseBindMatrices, i * 16);

					}

					if (outputJSON.skins === undefined) {

						outputJSON.skins = [];

					}

					outputJSON.skins.push({

						inverseBindMatrices: processAccessor(new THREE.BufferAttribute(inverseBindMatrices, 16)),
						joints: joints,
						skeleton: nodeMap[rootJoint.uuid]

					});

					var skinIndex = node.skin = outputJSON.skins.length - 1;

					return skinIndex;

				}

				/**
				 * Process Object3D node
				 * @param  {THREE.Object3D} node Object3D to processNode
				 * @return {Integer}      Index of the node in the nodes list
				 */
				function processNode(object) {

					if (object instanceof THREE.Light) {

						console.warn('GLTFExporter: Unsupported node type:', object.constructor.name);
						return null;

					}

					if (!outputJSON.nodes) {

						outputJSON.nodes = [];

					}

					var gltfNode = {};

					if (options.trs) {

						var rotation = object.quaternion.toArray();
						var position = object.position.toArray();
						var scale = object.scale.toArray();

						if (!equalArray(rotation, [0, 0, 0, 1])) {

							gltfNode.rotation = rotation;

						}

						if (!equalArray(position, [0, 0, 0])) {

							gltfNode.translation = position;

						}

						if (!equalArray(scale, [1, 1, 1])) {

							gltfNode.scale = scale;

						}

					} else {

						object.updateMatrix();
						if (!equalArray(object.matrix.elements, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])) {

							gltfNode.matrix = object.matrix.elements;

						}

					}

					// We don't export empty strings name because it represents no-name in Three.js.
					if (object.name !== '') {

						gltfNode.name = String(object.name);

					}

					if (object.userData && Object.keys(object.userData).length > 0) {

						try {

							gltfNode.extras = JSON.parse(JSON.stringify(object.userData));

						} catch (e) {

							throw new Error('THREE.GLTFExporter: userData can\'t be serialized');

						}

					}

					if (object instanceof THREE.Mesh ||
						object instanceof THREE.Line ||
						object instanceof THREE.Points) {

						gltfNode.mesh = processMesh(object);

					} else if (object instanceof THREE.Camera) {

						gltfNode.camera = processCamera(object);

					}

					if (object instanceof THREE.SkinnedMesh) {

						skins.push(object);

					}

					if (object.children.length > 0) {

						var children = [];

						for (var i = 0, l = object.children.length; i < l; i++) {

							var child = object.children[i];

							if (child.visible || options.onlyVisible === false) {

								var node = processNode(child);

								if (node !== null) {

									children.push(node);

								}

							}

						}

						if (children.length > 0) {

							gltfNode.children = children;

						}


					}

					outputJSON.nodes.push(gltfNode);

					var nodeIndex = nodeMap[object.uuid] = outputJSON.nodes.length - 1;

					return nodeIndex;

				}

				/**
				 * Process Scene
				 * @param  {THREE.Scene} node Scene to process
				 */
				function processScene(scene) {

					if (!outputJSON.scenes) {

						outputJSON.scenes = [];
						outputJSON.scene = 0;

					}

					var gltfScene = {

						nodes: []

					};

					if (scene.name) {

						gltfScene.name = scene.name;

					}

					outputJSON.scenes.push(gltfScene);

					var nodes = [];

					for (var i = 0, l = scene.children.length; i < l; i++) {

						var child = scene.children[i];

						if (child.visible || options.onlyVisible === false) {

							var node = processNode(child);

							if (node !== null) {

								nodes.push(node);

							}

						}

					}

					if (nodes.length > 0) {

						gltfScene.nodes = nodes;

					}

				}

				/**
				 * Creates a THREE.Scene to hold a list of objects and parse it
				 * @param  {Array} objects List of objects to process
				 */
				function processObjects(objects) {

					var scene = new THREE.Scene();
					scene.name = 'AuxScene';

					for (var i = 0; i < objects.length; i++) {

						// We push directly to children instead of calling `add` to prevent
						// modify the .parent and break its original scene and hierarchy
						scene.children.push(objects[i]);

					}

					processScene(scene);

				}

				function processInput(input) {

					input = input instanceof Array ? input : [input];

					var objectsWithoutScene = [];

					for (var i = 0; i < input.length; i++) {

						if (input[i] instanceof THREE.Scene) {

							processScene(input[i]);

						} else {

							objectsWithoutScene.push(input[i]);

						}

					}

					if (objectsWithoutScene.length > 0) {

						processObjects(objectsWithoutScene);

					}

					for (var i = 0; i < skins.length; ++i) {

						processSkin(skins[i]);

					}

					for (var i = 0; i < options.animations.length; ++i) {

						processAnimation(options.animations[i], input[0]);

					}

				}

				processInput(input);

				// Generate buffer
				// Create a new blob with all the dataviews from the buffers
				var blob = new Blob(dataViews, { type: 'application/octet-stream' });

				// Update the bytlength of the only main buffer and update the uri with the base64 representation of it
				if (outputJSON.buffers && outputJSON.buffers.length > 0) {

					outputJSON.buffers[0].byteLength = blob.size;

					var reader = new window.FileReader();

					if (options.binary === true) {

						// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#glb-file-format-specification

						var GLB_HEADER_BYTES = 12;
						var GLB_HEADER_MAGIC = 0x46546C67;
						var GLB_VERSION = 2;

						var GLB_CHUNK_PREFIX_BYTES = 8;
						var GLB_CHUNK_TYPE_JSON = 0x4E4F534A;
						var GLB_CHUNK_TYPE_BIN = 0x004E4942;

						reader.readAsArrayBuffer(blob);
						reader.onloadend = function () {

							// Binary chunk.
							var binaryChunk = getPaddedArrayBuffer(reader.result);
							var binaryChunkPrefix = new DataView(new ArrayBuffer(GLB_CHUNK_PREFIX_BYTES));
							binaryChunkPrefix.setUint32(0, binaryChunk.byteLength, true);
							binaryChunkPrefix.setUint32(4, GLB_CHUNK_TYPE_BIN, true);

							// JSON chunk.
							delete outputJSON.buffers[0].uri; // Omitted URI indicates use of binary chunk.
							var jsonChunk = stringToArrayBuffer(JSON.stringify(outputJSON), true);
							var jsonChunkPrefix = new DataView(new ArrayBuffer(GLB_CHUNK_PREFIX_BYTES));
							jsonChunkPrefix.setUint32(0, jsonChunk.byteLength, true);
							jsonChunkPrefix.setUint32(4, GLB_CHUNK_TYPE_JSON, true);

							// GLB header.
							var header = new ArrayBuffer(GLB_HEADER_BYTES);
							var headerView = new DataView(header);
							headerView.setUint32(0, GLB_HEADER_MAGIC, true);
							headerView.setUint32(4, GLB_VERSION, true);
							var totalByteLength = GLB_HEADER_BYTES
								+ jsonChunkPrefix.byteLength + jsonChunk.byteLength
								+ binaryChunkPrefix.byteLength + binaryChunk.byteLength;
							headerView.setUint32(8, totalByteLength, true);

							var glbBlob = new Blob([
								header,
								jsonChunkPrefix,
								jsonChunk,
								binaryChunkPrefix,
								binaryChunk
							], { type: 'application/octet-stream' });

							var glbReader = new window.FileReader();
							glbReader.readAsArrayBuffer(glbBlob);
							glbReader.onloadend = function () {

								onDone(glbReader.result);

							};

						};

					} else {

						reader.readAsDataURL(blob);
						reader.onloadend = function () {

							var base64data = reader.result;
							outputJSON.buffers[0].uri = base64data;
							onDone(outputJSON);

						};

					}

				} else {

					onDone(outputJSON);

				}

			}

		};

		/**
		 * @author Don McCurdy / https://www.donmccurdy.com
		 */
		/* global QUnit */

		QUnit.module('Exporters', () => {

			QUnit.module('GLTFExporter', () => {

				QUnit.test('constructor', (assert) => {

					assert.ok(new THREE.GLTFExporter(), 'Can instantiate an exporter.');

				});

				QUnit.test('parse - metadata', (assert) => {

					var done = assert.async();

					var object = new THREE.Object3D();

					var exporter = new THREE.GLTFExporter();

					exporter.parse(object, function (gltf) {

						assert.equal('2.0', gltf.asset.version, 'asset.version');
						assert.equal('THREE.GLTFExporter', gltf.asset.generator, 'asset.generator');

						done();

					});

				});

				QUnit.test('parse - basic', (assert) => {

					var done = assert.async();

					var box = new THREE.Mesh(
						new THREE.CubeGeometry(1, 1, 1),
						new THREE.MeshStandardMaterial({ color: 0xFF0000 })
					);

					var exporter = new THREE.GLTFExporter();

					exporter.parse(box, function (gltf) {

						assert.equal(1, gltf.nodes.length, 'correct number of nodes');
						assert.equal(0, gltf.nodes[0].mesh, 'node references mesh');
						assert.equal(1, gltf.meshes[0].primitives.length, 'correct number of primitives');

						var primitive = gltf.meshes[0].primitives[0];
						var material = gltf.materials[primitive.material];

						assert.equal(4, primitive.mode, 'mesh uses TRIANGLES mode');
						assert.ok(primitive.attributes.POSITION !== undefined, 'mesh contains position data');
						assert.ok(primitive.attributes.NORMAL !== undefined, 'mesh contains normal data');

						assert.smartEqual({

							baseColorFactor: [1, 0, 0, 1],
							metallicFactor: 0.5,
							roughnessFactor: 0.5

						}, material.pbrMetallicRoughness, 'material');

						done();

					});

				});

				QUnit.test('parse - animation', (assert) => {

					var done = assert.async();

					var mesh1 = new THREE.Mesh();
					mesh1.name = 'mesh1';

					var mesh2 = new THREE.Mesh();
					mesh2.name = 'mesh2';

					var mesh3 = new THREE.Mesh();
					mesh3.name = 'mesh3';

					var scene = new THREE.Scene();
					scene.add(mesh1, mesh2, mesh3);

					var clip1 = new THREE.AnimationClip('clip1', undefined, [

						new THREE.VectorKeyframeTrack('mesh1.position', [0, 1, 2], [0, 0, 0, 30, 0, 0, 0, 0, 0])

					]);

					var clip2 = new THREE.AnimationClip('clip2', undefined, [

						new THREE.VectorKeyframeTrack('mesh3.scale', [0, 1, 2], [1, 1, 1, 2, 2, 2, 1, 1, 1])

					]);

					var exporter = new THREE.GLTFExporter();

					exporter.parse(scene, function (gltf) {

						assert.equal(2, gltf.animations.length, 'one animation per clip');

						var target1 = gltf.animations[0].channels[0].target;
						var target2 = gltf.animations[1].channels[0].target;

						assert.equal('mesh1', gltf.nodes[target1.node].name, 'clip1 node');
						assert.equal('translation', target1.path, 'clip1 property');
						assert.equal('mesh3', gltf.nodes[target2.node].name, 'clip2 node');
						assert.equal('scale', target2.path, 'clip2 property');

						done();

					}, { animations: [clip1, clip2] });

				});


			});

		});

		/**
		 * @author Rich Tibbett / https://github.com/richtr
		 * @author mrdoob / http://mrdoob.com/
		 * @author Tony Parisi / http://www.tonyparisi.com/
		 * @author Takahiro / https://github.com/takahirox
		 * @author Don McCurdy / https://www.donmccurdy.com
		 */

		THREE.GLTFLoader = (function () {

			function GLTFLoader(manager) {

				this.manager = (manager !== undefined) ? manager : THREE.DefaultLoadingManager;
				this.dracoLoader = null;

			}

			GLTFLoader.prototype = {

				constructor: GLTFLoader,

				crossOrigin: 'Anonymous',

				load: function (url, onLoad, onProgress, onError) {

					var scope = this;

					var path = this.path !== undefined ? this.path : THREE.LoaderUtils.extractUrlBase(url);

					var loader = new THREE.FileLoader(scope.manager);

					loader.setResponseType('arraybuffer');

					loader.load(url, function (data) {

						try {

							scope.parse(data, path, onLoad, onError);

						} catch (e) {

							if (onError !== undefined) {

								onError(e);

							} else {

								throw e;

							}

						}

					}, onProgress, onError);

				},

				setCrossOrigin: function (value) {

					this.crossOrigin = value;
					return this;

				},

				setPath: function (value) {

					this.path = value;
					return this;

				},

				setDRACOLoader: function (dracoLoader) {

					this.dracoLoader = dracoLoader;

				},

				parse: function (data, path, onLoad, onError) {

					var content;
					var extensions = {};

					if (typeof data === 'string') {

						content = data;

					} else {

						var magic = THREE.LoaderUtils.decodeText(new Uint8Array(data, 0, 4));

						if (magic === BINARY_EXTENSION_HEADER_MAGIC) {

							try {

								extensions[EXTENSIONS.KHR_BINARY_GLTF] = new GLTFBinaryExtension(data);

							} catch (error) {

								if (onError) onError(error);
								return;

							}

							content = extensions[EXTENSIONS.KHR_BINARY_GLTF].content;

						} else {

							content = THREE.LoaderUtils.decodeText(new Uint8Array(data));

						}

					}

					var json = JSON.parse(content);

					if (json.asset === undefined || json.asset.version[0] < 2) {

						if (onError) onError(new Error('THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported. Use LegacyGLTFLoader instead.'));
						return;

					}

					if (json.extensionsUsed) {

						if (json.extensionsUsed.indexOf(EXTENSIONS.KHR_LIGHTS) >= 0) {

							extensions[EXTENSIONS.KHR_LIGHTS] = new GLTFLightsExtension(json);

						}

						if (json.extensionsUsed.indexOf(EXTENSIONS.KHR_MATERIALS_UNLIT) >= 0) {

							extensions[EXTENSIONS.KHR_MATERIALS_UNLIT] = new GLTFMaterialsUnlitExtension(json);

						}

						if (json.extensionsUsed.indexOf(EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS) >= 0) {

							extensions[EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS] = new GLTFMaterialsPbrSpecularGlossinessExtension();

						}

						if (json.extensionsUsed.indexOf(EXTENSIONS.KHR_DRACO_MESH_COMPRESSION) >= 0) {

							extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION] = new GLTFDracoMeshCompressionExtension(this.dracoLoader);

						}

					}

					console.time('GLTFLoader');

					var parser = new GLTFParser(json, extensions, {

						path: path || this.path || '',
						crossOrigin: this.crossOrigin,
						manager: this.manager

					});

					parser.parse(function (scene, scenes, cameras, animations, asset) {

						console.timeEnd('GLTFLoader');

						var glTF = {
							scene: scene,
							scenes: scenes,
							cameras: cameras,
							animations: animations,
							asset: asset
						};

						onLoad(glTF);

					}, onError);

				}

			};

			/* GLTFREGISTRY */

			function GLTFRegistry() {

				var objects = {};

				return {

					get: function (key) {

						return objects[key];

					},

					add: function (key, object) {

						objects[key] = object;

					},

					remove: function (key) {

						delete objects[key];

					},

					removeAll: function () {

						objects = {};

					}

				};

			}

			/*********************************/
			/********** EXTENSIONS ***********/
			/*********************************/

			var EXTENSIONS = {
				KHR_BINARY_GLTF: 'KHR_binary_glTF',
				KHR_DRACO_MESH_COMPRESSION: 'KHR_draco_mesh_compression',
				KHR_LIGHTS: 'KHR_lights',
				KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS: 'KHR_materials_pbrSpecularGlossiness',
				KHR_MATERIALS_UNLIT: 'KHR_materials_unlit'
			};

			/**
			 * Lights Extension
			 *
			 * Specification: PENDING
			 */
			function GLTFLightsExtension(json) {

				this.name = EXTENSIONS.KHR_LIGHTS;

				this.lights = {};

				var extension = (json.extensions && json.extensions[EXTENSIONS.KHR_LIGHTS]) || {};
				var lights = extension.lights || {};

				for (var lightId in lights) {

					var light = lights[lightId];
					var lightNode;

					var color = new THREE.Color().fromArray(light.color);

					switch (light.type) {

						case 'directional':
							lightNode = new THREE.DirectionalLight(color);
							lightNode.position.set(0, 0, 1);
							break;

						case 'point':
							lightNode = new THREE.PointLight(color);
							break;

						case 'spot':
							lightNode = new THREE.SpotLight(color);
							lightNode.position.set(0, 0, 1);
							break;

						case 'ambient':
							lightNode = new THREE.AmbientLight(color);
							break;

					}

					if (lightNode) {

						if (light.constantAttenuation !== undefined) {

							lightNode.intensity = light.constantAttenuation;

						}

						if (light.linearAttenuation !== undefined) {

							lightNode.distance = 1 / light.linearAttenuation;

						}

						if (light.quadraticAttenuation !== undefined) {

							lightNode.decay = light.quadraticAttenuation;

						}

						if (light.fallOffAngle !== undefined) {

							lightNode.angle = light.fallOffAngle;

						}

						if (light.fallOffExponent !== undefined) {

							console.warn('THREE.GLTFLoader:: light.fallOffExponent not currently supported.');

						}

						lightNode.name = light.name || ('light_' + lightId);
						this.lights[lightId] = lightNode;

					}

				}

			}

			/**
			 * Unlit Materials Extension (pending)
			 *
			 * PR: https://github.com/KhronosGroup/glTF/pull/1163
			 */
			function GLTFMaterialsUnlitExtension(json) {

				this.name = EXTENSIONS.KHR_MATERIALS_UNLIT;

			}

			GLTFMaterialsUnlitExtension.prototype.getMaterialType = function (material) {

				return THREE.MeshBasicMaterial;

			};

			GLTFMaterialsUnlitExtension.prototype.extendParams = function (materialParams, material, parser) {

				var pending = [];

				materialParams.color = new THREE.Color(1.0, 1.0, 1.0);
				materialParams.opacity = 1.0;

				var metallicRoughness = material.pbrMetallicRoughness;

				if (metallicRoughness) {

					if (Array.isArray(metallicRoughness.baseColorFactor)) {

						var array = metallicRoughness.baseColorFactor;

						materialParams.color.fromArray(array);
						materialParams.opacity = array[3];

					}

					if (metallicRoughness.baseColorTexture !== undefined) {

						pending.push(parser.assignTexture(materialParams, 'map', metallicRoughness.baseColorTexture.index));

					}

				}

				return Promise.all(pending);

			};

			/* BINARY EXTENSION */

			var BINARY_EXTENSION_HEADER_MAGIC = 'glTF';
			var BINARY_EXTENSION_HEADER_LENGTH = 12;
			var BINARY_EXTENSION_CHUNK_TYPES = { JSON: 0x4E4F534A, BIN: 0x004E4942 };

			function GLTFBinaryExtension(data) {

				this.name = EXTENSIONS.KHR_BINARY_GLTF;
				this.content = null;
				this.body = null;

				var headerView = new DataView(data, 0, BINARY_EXTENSION_HEADER_LENGTH);

				this.header = {
					magic: THREE.LoaderUtils.decodeText(new Uint8Array(data.slice(0, 4))),
					version: headerView.getUint32(4, true),
					length: headerView.getUint32(8, true)
				};

				if (this.header.magic !== BINARY_EXTENSION_HEADER_MAGIC) {

					throw new Error('THREE.GLTFLoader: Unsupported glTF-Binary header.');

				} else if (this.header.version < 2.0) {

					throw new Error('THREE.GLTFLoader: Legacy binary file detected. Use LegacyGLTFLoader instead.');

				}

				var chunkView = new DataView(data, BINARY_EXTENSION_HEADER_LENGTH);
				var chunkIndex = 0;

				while (chunkIndex < chunkView.byteLength) {

					var chunkLength = chunkView.getUint32(chunkIndex, true);
					chunkIndex += 4;

					var chunkType = chunkView.getUint32(chunkIndex, true);
					chunkIndex += 4;

					if (chunkType === BINARY_EXTENSION_CHUNK_TYPES.JSON) {

						var contentArray = new Uint8Array(data, BINARY_EXTENSION_HEADER_LENGTH + chunkIndex, chunkLength);
						this.content = THREE.LoaderUtils.decodeText(contentArray);

					} else if (chunkType === BINARY_EXTENSION_CHUNK_TYPES.BIN) {

						var byteOffset = BINARY_EXTENSION_HEADER_LENGTH + chunkIndex;
						this.body = data.slice(byteOffset, byteOffset + chunkLength);

					}

					// Clients must ignore chunks with unknown types.

					chunkIndex += chunkLength;

				}

				if (this.content === null) {

					throw new Error('THREE.GLTFLoader: JSON content not found.');

				}

			}

			/**
			 * DRACO Mesh Compression Extension
			 *
			 * Specification: https://github.com/KhronosGroup/glTF/pull/874
			 */
			function GLTFDracoMeshCompressionExtension(dracoLoader) {

				if (!dracoLoader) {

					throw new Error('THREE.GLTFLoader: No DRACOLoader instance provided.');

				}

				this.name = EXTENSIONS.KHR_DRACO_MESH_COMPRESSION;
				this.dracoLoader = dracoLoader;

			}

			GLTFDracoMeshCompressionExtension.prototype.decodePrimitive = function (primitive, parser) {

				var dracoLoader = this.dracoLoader;
				var bufferViewIndex = primitive.extensions[this.name].bufferView;
				var gltfAttributeMap = primitive.extensions[this.name].attributes;
				var threeAttributeMap = {};

				for (var attributeName in gltfAttributeMap) {

					if (!(attributeName in ATTRIBUTES)) continue;

					threeAttributeMap[ATTRIBUTES[attributeName]] = gltfAttributeMap[attributeName];

				}

				return parser.getDependency('bufferView', bufferViewIndex).then(function (bufferView) {

					return new Promise(function (resolve) {

						dracoLoader.decodeDracoFile(bufferView, resolve, threeAttributeMap);

					});

				});

			};

			/**
			 * Specular-Glossiness Extension
			 *
			 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_pbrSpecularGlossiness
			 */
			function GLTFMaterialsPbrSpecularGlossinessExtension() {

				return {

					name: EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS,

					specularGlossinessParams: [
						'color',
						'map',
						'lightMap',
						'lightMapIntensity',
						'aoMap',
						'aoMapIntensity',
						'emissive',
						'emissiveIntensity',
						'emissiveMap',
						'bumpMap',
						'bumpScale',
						'normalMap',
						'displacementMap',
						'displacementScale',
						'displacementBias',
						'specularMap',
						'specular',
						'glossinessMap',
						'glossiness',
						'alphaMap',
						'envMap',
						'envMapIntensity',
						'refractionRatio',
					],

					getMaterialType: function () {

						return THREE.ShaderMaterial;

					},

					extendParams: function (params, material, parser) {

						var pbrSpecularGlossiness = material.extensions[this.name];

						var shader = THREE.ShaderLib['standard'];

						var uniforms = THREE.UniformsUtils.clone(shader.uniforms);

						var specularMapParsFragmentChunk = [
							'#ifdef USE_SPECULARMAP',
							'	uniform sampler2D specularMap;',
							'#endif'
						].join('\n');

						var glossinessMapParsFragmentChunk = [
							'#ifdef USE_GLOSSINESSMAP',
							'	uniform sampler2D glossinessMap;',
							'#endif'
						].join('\n');

						var specularMapFragmentChunk = [
							'vec3 specularFactor = specular;',
							'#ifdef USE_SPECULARMAP',
							'	vec4 texelSpecular = texture2D( specularMap, vUv );',
							'	texelSpecular = sRGBToLinear( texelSpecular );',
							'	// reads channel RGB, compatible with a glTF Specular-Glossiness (RGBA) texture',
							'	specularFactor *= texelSpecular.rgb;',
							'#endif'
						].join('\n');

						var glossinessMapFragmentChunk = [
							'float glossinessFactor = glossiness;',
							'#ifdef USE_GLOSSINESSMAP',
							'	vec4 texelGlossiness = texture2D( glossinessMap, vUv );',
							'	// reads channel A, compatible with a glTF Specular-Glossiness (RGBA) texture',
							'	glossinessFactor *= texelGlossiness.a;',
							'#endif'
						].join('\n');

						var lightPhysicalFragmentChunk = [
							'PhysicalMaterial material;',
							'material.diffuseColor = diffuseColor.rgb;',
							'material.specularRoughness = clamp( 1.0 - glossinessFactor, 0.04, 1.0 );',
							'material.specularColor = specularFactor.rgb;',
						].join('\n');

						var fragmentShader = shader.fragmentShader
							.replace('#include <specularmap_fragment>', '')
							.replace('uniform float roughness;', 'uniform vec3 specular;')
							.replace('uniform float metalness;', 'uniform float glossiness;')
							.replace('#include <roughnessmap_pars_fragment>', specularMapParsFragmentChunk)
							.replace('#include <metalnessmap_pars_fragment>', glossinessMapParsFragmentChunk)
							.replace('#include <roughnessmap_fragment>', specularMapFragmentChunk)
							.replace('#include <metalnessmap_fragment>', glossinessMapFragmentChunk)
							.replace('#include <lights_physical_fragment>', lightPhysicalFragmentChunk);

						delete uniforms.roughness;
						delete uniforms.metalness;
						delete uniforms.roughnessMap;
						delete uniforms.metalnessMap;

						uniforms.specular = { value: new THREE.Color().setHex(0x111111) };
						uniforms.glossiness = { value: 0.5 };
						uniforms.specularMap = { value: null };
						uniforms.glossinessMap = { value: null };

						params.vertexShader = shader.vertexShader;
						params.fragmentShader = fragmentShader;
						params.uniforms = uniforms;
						params.defines = { 'STANDARD': '' };

						params.color = new THREE.Color(1.0, 1.0, 1.0);
						params.opacity = 1.0;

						var pending = [];

						if (Array.isArray(pbrSpecularGlossiness.diffuseFactor)) {

							var array = pbrSpecularGlossiness.diffuseFactor;

							params.color.fromArray(array);
							params.opacity = array[3];

						}

						if (pbrSpecularGlossiness.diffuseTexture !== undefined) {

							pending.push(parser.assignTexture(params, 'map', pbrSpecularGlossiness.diffuseTexture.index));

						}

						params.emissive = new THREE.Color(0.0, 0.0, 0.0);
						params.glossiness = pbrSpecularGlossiness.glossinessFactor !== undefined ? pbrSpecularGlossiness.glossinessFactor : 1.0;
						params.specular = new THREE.Color(1.0, 1.0, 1.0);

						if (Array.isArray(pbrSpecularGlossiness.specularFactor)) {

							params.specular.fromArray(pbrSpecularGlossiness.specularFactor);

						}

						if (pbrSpecularGlossiness.specularGlossinessTexture !== undefined) {

							var specGlossIndex = pbrSpecularGlossiness.specularGlossinessTexture.index;
							pending.push(parser.assignTexture(params, 'glossinessMap', specGlossIndex));
							pending.push(parser.assignTexture(params, 'specularMap', specGlossIndex));

						}

						return Promise.all(pending);

					},

					createMaterial: function (params) {

						// setup material properties based on MeshStandardMaterial for Specular-Glossiness

						var material = new THREE.ShaderMaterial({
							defines: params.defines,
							vertexShader: params.vertexShader,
							fragmentShader: params.fragmentShader,
							uniforms: params.uniforms,
							fog: true,
							lights: true,
							opacity: params.opacity,
							transparent: params.transparent
						});

						material.isGLTFSpecularGlossinessMaterial = true;

						material.color = params.color;

						material.map = params.map === undefined ? null : params.map;

						material.lightMap = null;
						material.lightMapIntensity = 1.0;

						material.aoMap = params.aoMap === undefined ? null : params.aoMap;
						material.aoMapIntensity = 1.0;

						material.emissive = params.emissive;
						material.emissiveIntensity = 1.0;
						material.emissiveMap = params.emissiveMap === undefined ? null : params.emissiveMap;

						material.bumpMap = params.bumpMap === undefined ? null : params.bumpMap;
						material.bumpScale = 1;

						material.normalMap = params.normalMap === undefined ? null : params.normalMap;
						if (params.normalScale) material.normalScale = params.normalScale;

						material.displacementMap = null;
						material.displacementScale = 1;
						material.displacementBias = 0;

						material.specularMap = params.specularMap === undefined ? null : params.specularMap;
						material.specular = params.specular;

						material.glossinessMap = params.glossinessMap === undefined ? null : params.glossinessMap;
						material.glossiness = params.glossiness;

						material.alphaMap = null;

						material.envMap = params.envMap === undefined ? null : params.envMap;
						material.envMapIntensity = 1.0;

						material.refractionRatio = 0.98;

						material.extensions.derivatives = true;

						return material;

					},

					/**
					 * Clones a GLTFSpecularGlossinessMaterial instance. The ShaderMaterial.copy() method can
					 * copy only properties it knows about or inherits, and misses many properties that would
					 * normally be defined by MeshStandardMaterial.
					 *
					 * This method allows GLTFSpecularGlossinessMaterials to be cloned in the process of
					 * loading a glTF model, but cloning later (e.g. by the user) would require these changes
					 * AND also updating `.onBeforeRender` on the parent mesh.
					 *
					 * @param  {THREE.ShaderMaterial} source
					 * @return {THREE.ShaderMaterial}
					 */
					cloneMaterial: function (source) {

						var target = source.clone();

						target.isGLTFSpecularGlossinessMaterial = true;

						var params = this.specularGlossinessParams;

						for (var i = 0, il = params.length; i < il; i++) {

							target[params[i]] = source[params[i]];

						}

						return target;

					},

					// Here's based on refreshUniformsCommon() and refreshUniformsStandard() in WebGLRenderer.
					refreshUniforms: function (renderer, scene, camera, geometry, material, group) {

						if (material.isGLTFSpecularGlossinessMaterial !== true) {

							return;

						}

						var uniforms = material.uniforms;
						var defines = material.defines;

						uniforms.opacity.value = material.opacity;

						uniforms.diffuse.value.copy(material.color);
						uniforms.emissive.value.copy(material.emissive).multiplyScalar(material.emissiveIntensity);

						uniforms.map.value = material.map;
						uniforms.specularMap.value = material.specularMap;
						uniforms.alphaMap.value = material.alphaMap;

						uniforms.lightMap.value = material.lightMap;
						uniforms.lightMapIntensity.value = material.lightMapIntensity;

						uniforms.aoMap.value = material.aoMap;
						uniforms.aoMapIntensity.value = material.aoMapIntensity;

						// uv repeat and offset setting priorities
						// 1. color map
						// 2. specular map
						// 3. normal map
						// 4. bump map
						// 5. alpha map
						// 6. emissive map

						var uvScaleMap;

						if (material.map) {

							uvScaleMap = material.map;

						} else if (material.specularMap) {

							uvScaleMap = material.specularMap;

						} else if (material.displacementMap) {

							uvScaleMap = material.displacementMap;

						} else if (material.normalMap) {

							uvScaleMap = material.normalMap;

						} else if (material.bumpMap) {

							uvScaleMap = material.bumpMap;

						} else if (material.glossinessMap) {

							uvScaleMap = material.glossinessMap;

						} else if (material.alphaMap) {

							uvScaleMap = material.alphaMap;

						} else if (material.emissiveMap) {

							uvScaleMap = material.emissiveMap;

						}

						if (uvScaleMap !== undefined) {

							// backwards compatibility
							if (uvScaleMap.isWebGLRenderTarget) {

								uvScaleMap = uvScaleMap.texture;

							}

							var offset;
							var repeat;

							if (uvScaleMap.matrix !== undefined) {

								// > r88.

								if (uvScaleMap.matrixAutoUpdate === true) {

									offset = uvScaleMap.offset;
									repeat = uvScaleMap.repeat;
									var rotation = uvScaleMap.rotation;
									var center = uvScaleMap.center;

									uvScaleMap.matrix.setUvTransform(offset.x, offset.y, repeat.x, repeat.y, rotation, center.x, center.y);

								}

								uniforms.uvTransform.value.copy(uvScaleMap.matrix);

							} else {

								// <= r87. Remove when reasonable.

								offset = uvScaleMap.offset;
								repeat = uvScaleMap.repeat;

								uniforms.offsetRepeat.value.set(offset.x, offset.y, repeat.x, repeat.y);

							}

						}

						uniforms.envMap.value = material.envMap;
						uniforms.envMapIntensity.value = material.envMapIntensity;
						uniforms.flipEnvMap.value = (material.envMap && material.envMap.isCubeTexture) ? - 1 : 1;

						uniforms.refractionRatio.value = material.refractionRatio;

						uniforms.specular.value.copy(material.specular);
						uniforms.glossiness.value = material.glossiness;

						uniforms.glossinessMap.value = material.glossinessMap;

						uniforms.emissiveMap.value = material.emissiveMap;
						uniforms.bumpMap.value = material.bumpMap;
						uniforms.normalMap.value = material.normalMap;

						uniforms.displacementMap.value = material.displacementMap;
						uniforms.displacementScale.value = material.displacementScale;
						uniforms.displacementBias.value = material.displacementBias;

						if (uniforms.glossinessMap.value !== null && defines.USE_GLOSSINESSMAP === undefined) {

							defines.USE_GLOSSINESSMAP = '';
							// set USE_ROUGHNESSMAP to enable vUv
							defines.USE_ROUGHNESSMAP = '';

						}

						if (uniforms.glossinessMap.value === null && defines.USE_GLOSSINESSMAP !== undefined) {

							delete defines.USE_GLOSSINESSMAP;
							delete defines.USE_ROUGHNESSMAP;

						}

					}

				};

			}

			/*********************************/
			/********** INTERPOLATION ********/
			/*********************************/

			// Spline Interpolation
			// Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#appendix-c-spline-interpolation
			function GLTFCubicSplineInterpolant(parameterPositions, sampleValues, sampleSize, resultBuffer) {

				THREE.Interpolant.call(this, parameterPositions, sampleValues, sampleSize, resultBuffer);

			}

			GLTFCubicSplineInterpolant.prototype = Object.create(THREE.Interpolant.prototype);
			GLTFCubicSplineInterpolant.prototype.constructor = GLTFCubicSplineInterpolant;

			GLTFCubicSplineInterpolant.prototype.interpolate_ = function (i1, t0, t, t1) {

				var result = this.resultBuffer;
				var values = this.sampleValues;
				var stride = this.valueSize;

				var stride2 = stride * 2;
				var stride3 = stride * 3;

				var td = t1 - t0;

				var p = (t - t0) / td;
				var pp = p * p;
				var ppp = pp * p;

				var offset1 = i1 * stride3;
				var offset0 = offset1 - stride3;

				var s0 = 2 * ppp - 3 * pp + 1;
				var s1 = ppp - 2 * pp + p;
				var s2 = - 2 * ppp + 3 * pp;
				var s3 = ppp - pp;

				// Layout of keyframe output values for CUBICSPLINE animations:
				//   [ inTangent_1, splineVertex_1, outTangent_1, inTangent_2, splineVertex_2, ... ]
				for (var i = 0; i !== stride; i++) {

					var p0 = values[offset0 + i + stride];        // splineVertex_k
					var m0 = values[offset0 + i + stride2] * td;  // outTangent_k * (t_k+1 - t_k)
					var p1 = values[offset1 + i + stride];        // splineVertex_k+1
					var m1 = values[offset1 + i] * td;            // inTangent_k+1 * (t_k+1 - t_k)

					result[i] = s0 * p0 + s1 * m0 + s2 * p1 + s3 * m1;

				}

				return result;

			};

			/*********************************/
			/********** INTERNALS ************/
			/*********************************/

			/* CONSTANTS */

			var WEBGL_CONSTANTS = {
				FLOAT: 5126,
				//FLOAT_MAT2: 35674,
				FLOAT_MAT3: 35675,
				FLOAT_MAT4: 35676,
				FLOAT_VEC2: 35664,
				FLOAT_VEC3: 35665,
				FLOAT_VEC4: 35666,
				LINEAR: 9729,
				REPEAT: 10497,
				SAMPLER_2D: 35678,
				POINTS: 0,
				LINES: 1,
				LINE_LOOP: 2,
				LINE_STRIP: 3,
				TRIANGLES: 4,
				TRIANGLE_STRIP: 5,
				TRIANGLE_FAN: 6,
				UNSIGNED_BYTE: 5121,
				UNSIGNED_SHORT: 5123
			};

			var WEBGL_TYPE = {
				5126: Number,
				//35674: THREE.Matrix2,
				35675: THREE.Matrix3,
				35676: THREE.Matrix4,
				35664: THREE.Vector2,
				35665: THREE.Vector3,
				35666: THREE.Vector4,
				35678: THREE.Texture
			};

			var WEBGL_COMPONENT_TYPES = {
				5120: Int8Array,
				5121: Uint8Array,
				5122: Int16Array,
				5123: Uint16Array,
				5125: Uint32Array,
				5126: Float32Array
			};

			var WEBGL_FILTERS = {
				9728: THREE.NearestFilter,
				9729: THREE.LinearFilter,
				9984: THREE.NearestMipMapNearestFilter,
				9985: THREE.LinearMipMapNearestFilter,
				9986: THREE.NearestMipMapLinearFilter,
				9987: THREE.LinearMipMapLinearFilter
			};

			var WEBGL_WRAPPINGS = {
				33071: THREE.ClampToEdgeWrapping,
				33648: THREE.MirroredRepeatWrapping,
				10497: THREE.RepeatWrapping
			};

			var WEBGL_TEXTURE_FORMATS = {
				6406: THREE.AlphaFormat,
				6407: THREE.RGBFormat,
				6408: THREE.RGBAFormat,
				6409: THREE.LuminanceFormat,
				6410: THREE.LuminanceAlphaFormat
			};

			var WEBGL_TEXTURE_DATATYPES = {
				5121: THREE.UnsignedByteType,
				32819: THREE.UnsignedShort4444Type,
				32820: THREE.UnsignedShort5551Type,
				33635: THREE.UnsignedShort565Type
			};

			var WEBGL_SIDES = {
				1028: THREE.BackSide, // Culling front
				1029: THREE.FrontSide // Culling back
				//1032: THREE.NoSide   // Culling front and back, what to do?
			};

			var WEBGL_DEPTH_FUNCS = {
				512: THREE.NeverDepth,
				513: THREE.LessDepth,
				514: THREE.EqualDepth,
				515: THREE.LessEqualDepth,
				516: THREE.GreaterEqualDepth,
				517: THREE.NotEqualDepth,
				518: THREE.GreaterEqualDepth,
				519: THREE.AlwaysDepth
			};

			var WEBGL_BLEND_EQUATIONS = {
				32774: THREE.AddEquation,
				32778: THREE.SubtractEquation,
				32779: THREE.ReverseSubtractEquation
			};

			var WEBGL_BLEND_FUNCS = {
				0: THREE.ZeroFactor,
				1: THREE.OneFactor,
				768: THREE.SrcColorFactor,
				769: THREE.OneMinusSrcColorFactor,
				770: THREE.SrcAlphaFactor,
				771: THREE.OneMinusSrcAlphaFactor,
				772: THREE.DstAlphaFactor,
				773: THREE.OneMinusDstAlphaFactor,
				774: THREE.DstColorFactor,
				775: THREE.OneMinusDstColorFactor,
				776: THREE.SrcAlphaSaturateFactor
				// The followings are not supported by Three.js yet
				//32769: CONSTANT_COLOR,
				//32770: ONE_MINUS_CONSTANT_COLOR,
				//32771: CONSTANT_ALPHA,
				//32772: ONE_MINUS_CONSTANT_COLOR
			};

			var WEBGL_TYPE_SIZES = {
				'SCALAR': 1,
				'VEC2': 2,
				'VEC3': 3,
				'VEC4': 4,
				'MAT2': 4,
				'MAT3': 9,
				'MAT4': 16
			};

			var ATTRIBUTES = {
				POSITION: 'position',
				NORMAL: 'normal',
				TEXCOORD_0: 'uv',
				TEXCOORD0: 'uv', // deprecated
				TEXCOORD: 'uv', // deprecated
				TEXCOORD_1: 'uv2',
				COLOR_0: 'color',
				COLOR0: 'color', // deprecated
				COLOR: 'color', // deprecated
				WEIGHTS_0: 'skinWeight',
				WEIGHT: 'skinWeight', // deprecated
				JOINTS_0: 'skinIndex',
				JOINT: 'skinIndex' // deprecated
			};

			var PATH_PROPERTIES = {
				scale: 'scale',
				translation: 'position',
				rotation: 'quaternion',
				weights: 'morphTargetInfluences'
			};

			var INTERPOLATION = {
				CUBICSPLINE: THREE.InterpolateSmooth, // We use custom interpolation GLTFCubicSplineInterpolation for CUBICSPLINE.
				// KeyframeTrack.optimize() can't handle glTF Cubic Spline output values layout,
				// using THREE.InterpolateSmooth for KeyframeTrack instantiation to prevent optimization.
				// See KeyframeTrack.optimize() for the detail.
				LINEAR: THREE.InterpolateLinear,
				STEP: THREE.InterpolateDiscrete
			};

			var ALPHA_MODES = {
				OPAQUE: 'OPAQUE',
				MASK: 'MASK',
				BLEND: 'BLEND'
			};

			/* UTILITY FUNCTIONS */

			function resolveURL(url, path) {

				// Invalid URL
				if (typeof url !== 'string' || url === '') return '';

				// Absolute URL http://,https://,//
				if (/^(https?:)?\/\//i.test(url)) return url;

				// Data URI
				if (/^data:.*,.*$/i.test(url)) return url;

				// Blob URL
				if (/^blob:.*$/i.test(url)) return url;

				// Relative URL
				return path + url;

			}

			/**
			 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#default-material
			 */
			function createDefaultMaterial() {

				return new THREE.MeshStandardMaterial({
					color: 0xFFFFFF,
					emissive: 0x000000,
					metalness: 1,
					roughness: 1,
					transparent: false,
					depthTest: true,
					side: THREE.FrontSide
				});

			}

			/**
			 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#morph-targets
			 *
			 * @param {THREE.Mesh} mesh
			 * @param {GLTF.Mesh} meshDef
			 * @param {GLTF.Primitive} primitiveDef
			 * @param {Array<THREE.BufferAttribute>} accessors
			 */
			function addMorphTargets(mesh, meshDef, primitiveDef, accessors) {

				var geometry = mesh.geometry;
				var material = mesh.material;

				var targets = primitiveDef.targets;
				var morphAttributes = geometry.morphAttributes;

				morphAttributes.position = [];
				morphAttributes.normal = [];

				material.morphTargets = true;

				for (var i = 0, il = targets.length; i < il; i++) {

					var target = targets[i];
					var attributeName = 'morphTarget' + i;

					var positionAttribute, normalAttribute;

					if (target.POSITION !== undefined) {

						// Three.js morph formula is
						//   position
						//     + weight0 * ( morphTarget0 - position )
						//     + weight1 * ( morphTarget1 - position )
						//     ...
						// while the glTF one is
						//   position
						//     + weight0 * morphTarget0
						//     + weight1 * morphTarget1
						//     ...
						// then adding position to morphTarget.
						// So morphTarget value will depend on mesh's position, then cloning attribute
						// for the case if attribute is shared among two or more meshes.

						positionAttribute = cloneBufferAttribute(accessors[target.POSITION]);
						var position = geometry.attributes.position;

						for (var j = 0, jl = positionAttribute.count; j < jl; j++) {

							positionAttribute.setXYZ(
								j,
								positionAttribute.getX(j) + position.getX(j),
								positionAttribute.getY(j) + position.getY(j),
								positionAttribute.getZ(j) + position.getZ(j)
							);

						}

					} else if (geometry.attributes.position) {

						// Copying the original position not to affect the final position.
						// See the formula above.
						positionAttribute = cloneBufferAttribute(geometry.attributes.position);

					}

					if (positionAttribute !== undefined) {

						positionAttribute.name = attributeName;
						morphAttributes.position.push(positionAttribute);

					}

					if (target.NORMAL !== undefined) {

						material.morphNormals = true;

						// see target.POSITION's comment

						normalAttribute = cloneBufferAttribute(accessors[target.NORMAL]);
						var normal = geometry.attributes.normal;

						for (var j = 0, jl = normalAttribute.count; j < jl; j++) {

							normalAttribute.setXYZ(
								j,
								normalAttribute.getX(j) + normal.getX(j),
								normalAttribute.getY(j) + normal.getY(j),
								normalAttribute.getZ(j) + normal.getZ(j)
							);

						}

					} else if (geometry.attributes.normal !== undefined) {

						normalAttribute = cloneBufferAttribute(geometry.attributes.normal);

					}

					if (normalAttribute !== undefined) {

						normalAttribute.name = attributeName;
						morphAttributes.normal.push(normalAttribute);

					}

				}

				mesh.updateMorphTargets();

				if (meshDef.weights !== undefined) {

					for (var i = 0, il = meshDef.weights.length; i < il; i++) {

						mesh.morphTargetInfluences[i] = meshDef.weights[i];

					}

				}

				// .extras has user-defined data, so check that .extras.targetNames is an array.
				if (meshDef.extras && Array.isArray(meshDef.extras.targetNames)) {

					for (var i = 0, il = meshDef.extras.targetNames.length; i < il; i++) {

						mesh.morphTargetDictionary[meshDef.extras.targetNames[i]] = i;

					}

				}

			}

			function isPrimitiveEqual(a, b) {

				if (a.indices !== b.indices) {

					return false;

				}

				var attribA = a.attributes || {};
				var attribB = b.attributes || {};
				var keysA = Object.keys(attribA);
				var keysB = Object.keys(attribB);

				if (keysA.length !== keysB.length) {

					return false;

				}

				for (var i = 0, il = keysA.length; i < il; i++) {

					var key = keysA[i];

					if (attribA[key] !== attribB[key]) {

						return false;

					}

				}

				return true;

			}

			function getCachedGeometry(cache, newPrimitive) {

				for (var i = 0, il = cache.length; i < il; i++) {

					var cached = cache[i];

					if (isPrimitiveEqual(cached.primitive, newPrimitive)) {

						return cached.promise;

					}

				}

				return null;

			}

			function cloneBufferAttribute(attribute) {

				if (attribute.isInterleavedBufferAttribute) {

					var count = attribute.count;
					var itemSize = attribute.itemSize;
					var array = attribute.array.slice(0, count * itemSize);

					for (var i = 0; i < count; ++i) {

						array[i] = attribute.getX(i);
						if (itemSize >= 2) array[i + 1] = attribute.getY(i);
						if (itemSize >= 3) array[i + 2] = attribute.getZ(i);
						if (itemSize >= 4) array[i + 3] = attribute.getW(i);

					}

					return new THREE.BufferAttribute(array, itemSize, attribute.normalized);

				}

				return attribute.clone();

			}

			/* GLTF PARSER */

			function GLTFParser(json, extensions, options) {

				this.json = json || {};
				this.extensions = extensions || {};
				this.options = options || {};

				// loader object cache
				this.cache = new GLTFRegistry();

				// BufferGeometry caching
				this.primitiveCache = [];

				this.textureLoader = new THREE.TextureLoader(this.options.manager);
				this.textureLoader.setCrossOrigin(this.options.crossOrigin);

				this.fileLoader = new THREE.FileLoader(this.options.manager);
				this.fileLoader.setResponseType('arraybuffer');

			}

			GLTFParser.prototype.parse = function (onLoad, onError) {

				var json = this.json;

				// Clear the loader cache
				this.cache.removeAll();

				// Mark the special nodes/meshes in json for efficient parse
				this.markDefs();

				// Fire the callback on complete
				this.getMultiDependencies([

					'scene',
					'animation',
					'camera'

				]).then(function (dependencies) {

					var scenes = dependencies.scenes || [];
					var scene = scenes[json.scene || 0];
					var animations = dependencies.animations || [];
					var asset = json.asset;
					var cameras = dependencies.cameras || [];

					onLoad(scene, scenes, cameras, animations, asset);

				}).catch(onError);

			};

			/**
			 * Marks the special nodes/meshes in json for efficient parse.
			 */
			GLTFParser.prototype.markDefs = function () {

				var nodeDefs = this.json.nodes || [];
				var skinDefs = this.json.skins || [];
				var meshDefs = this.json.meshes || [];

				var meshReferences = {};
				var meshUses = {};

				// Nothing in the node definition indicates whether it is a Bone or an
				// Object3D. Use the skins' joint references to mark bones.
				for (var skinIndex = 0, skinLength = skinDefs.length; skinIndex < skinLength; skinIndex++) {

					var joints = skinDefs[skinIndex].joints;

					for (var i = 0, il = joints.length; i < il; i++) {

						nodeDefs[joints[i]].isBone = true;

					}

				}

				// Meshes can (and should) be reused by multiple nodes in a glTF asset. To
				// avoid having more than one THREE.Mesh with the same name, count
				// references and rename instances below.
				//
				// Example: CesiumMilkTruck sample model reuses "Wheel" meshes.
				for (var nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex++) {

					var nodeDef = nodeDefs[nodeIndex];

					if (nodeDef.mesh !== undefined) {

						if (meshReferences[nodeDef.mesh] === undefined) {

							meshReferences[nodeDef.mesh] = meshUses[nodeDef.mesh] = 0;

						}

						meshReferences[nodeDef.mesh]++;

						// Nothing in the mesh definition indicates whether it is
						// a SkinnedMesh or Mesh. Use the node's mesh reference
						// to mark SkinnedMesh if node has skin.
						if (nodeDef.skin !== undefined) {

							meshDefs[nodeDef.mesh].isSkinnedMesh = true;

						}

					}

				}

				this.json.meshReferences = meshReferences;
				this.json.meshUses = meshUses;

			};

			/**
			 * Requests the specified dependency asynchronously, with caching.
			 * @param {string} type
			 * @param {number} index
			 * @return {Promise<Object>}
			 */
			GLTFParser.prototype.getDependency = function (type, index) {

				var cacheKey = type + ':' + index;
				var dependency = this.cache.get(cacheKey);

				if (!dependency) {

					var fnName = 'load' + type.charAt(0).toUpperCase() + type.slice(1);
					dependency = this[fnName](index);
					this.cache.add(cacheKey, dependency);

				}

				return dependency;

			};

			/**
			 * Requests all dependencies of the specified type asynchronously, with caching.
			 * @param {string} type
			 * @return {Promise<Array<Object>>}
			 */
			GLTFParser.prototype.getDependencies = function (type) {

				var dependencies = this.cache.get(type);

				if (!dependencies) {

					var parser = this;
					var defs = this.json[type + (type === 'mesh' ? 'es' : 's')] || [];

					dependencies = Promise.all(defs.map(function (def, index) {

						return parser.getDependency(type, index);

					}));

					this.cache.add(type, dependencies);

				}

				return dependencies;

			};

			/**
			 * Requests all multiple dependencies of the specified types asynchronously, with caching.
			 * @param {Array<string>} types
			 * @return {Promise<Object<Array<Object>>>}
			 */
			GLTFParser.prototype.getMultiDependencies = function (types) {

				var results = {};
				var pendings = [];

				for (var i = 0, il = types.length; i < il; i++) {

					var type = types[i];
					var value = this.getDependencies(type);

					value = value.then(function (key, value) {

						results[key] = value;

					}.bind(this, type + (type === 'mesh' ? 'es' : 's')));

					pendings.push(value);

				}

				return Promise.all(pendings).then(function () {

					return results;

				});

			};

			/**
			 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
			 * @param {number} bufferIndex
			 * @return {Promise<ArrayBuffer>}
			 */
			GLTFParser.prototype.loadBuffer = function (bufferIndex) {

				var bufferDef = this.json.buffers[bufferIndex];
				var loader = this.fileLoader;

				if (bufferDef.type && bufferDef.type !== 'arraybuffer') {

					throw new Error('THREE.GLTFLoader: ' + bufferDef.type + ' buffer type is not supported.');

				}

				// If present, GLB container is required to be the first buffer.
				if (bufferDef.uri === undefined && bufferIndex === 0) {

					return Promise.resolve(this.extensions[EXTENSIONS.KHR_BINARY_GLTF].body);

				}

				var options = this.options;

				return new Promise(function (resolve, reject) {

					loader.load(resolveURL(bufferDef.uri, options.path), resolve, undefined, function () {

						reject(new Error('THREE.GLTFLoader: Failed to load buffer "' + bufferDef.uri + '".'));

					});

				});

			};

			/**
			 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
			 * @param {number} bufferViewIndex
			 * @return {Promise<ArrayBuffer>}
			 */
			GLTFParser.prototype.loadBufferView = function (bufferViewIndex) {

				var bufferViewDef = this.json.bufferViews[bufferViewIndex];

				return this.getDependency('buffer', bufferViewDef.buffer).then(function (buffer) {

					var byteLength = bufferViewDef.byteLength || 0;
					var byteOffset = bufferViewDef.byteOffset || 0;
					return buffer.slice(byteOffset, byteOffset + byteLength);

				});

			};

			/**
			 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#accessors
			 * @param {number} accessorIndex
			 * @return {Promise<THREE.BufferAttribute|THREE.InterleavedBufferAttribute>}
			 */
			GLTFParser.prototype.loadAccessor = function (accessorIndex) {

				var parser = this;
				var json = this.json;

				var accessorDef = this.json.accessors[accessorIndex];

				if (accessorDef.bufferView === undefined && accessorDef.sparse === undefined) {

					// Ignore empty accessors, which may be used to declare runtime
					// information about attributes coming from another source (e.g. Draco
					// compression extension).
					return null;

				}

				var pendingBufferViews = [];

				if (accessorDef.bufferView !== undefined) {

					pendingBufferViews.push(this.getDependency('bufferView', accessorDef.bufferView));

				} else {

					pendingBufferViews.push(null);

				}

				if (accessorDef.sparse !== undefined) {

					pendingBufferViews.push(this.getDependency('bufferView', accessorDef.sparse.indices.bufferView));
					pendingBufferViews.push(this.getDependency('bufferView', accessorDef.sparse.values.bufferView));

				}

				return Promise.all(pendingBufferViews).then(function (bufferViews) {

					var bufferView = bufferViews[0];

					var itemSize = WEBGL_TYPE_SIZES[accessorDef.type];
					var TypedArray = WEBGL_COMPONENT_TYPES[accessorDef.componentType];

					// For VEC3: itemSize is 3, elementBytes is 4, itemBytes is 12.
					var elementBytes = TypedArray.BYTES_PER_ELEMENT;
					var itemBytes = elementBytes * itemSize;
					var byteOffset = accessorDef.byteOffset || 0;
					var byteStride = json.bufferViews[accessorDef.bufferView].byteStride;
					var normalized = accessorDef.normalized === true;
					var array, bufferAttribute;

					// The buffer is not interleaved if the stride is the item size in bytes.
					if (byteStride && byteStride !== itemBytes) {

						var ibCacheKey = 'InterleavedBuffer:' + accessorDef.bufferView + ':' + accessorDef.componentType;
						var ib = parser.cache.get(ibCacheKey);

						if (!ib) {

							// Use the full buffer if it's interleaved.
							array = new TypedArray(bufferView);

							// Integer parameters to IB/IBA are in array elements, not bytes.
							ib = new THREE.InterleavedBuffer(array, byteStride / elementBytes);

							parser.cache.add(ibCacheKey, ib);

						}

						bufferAttribute = new THREE.InterleavedBufferAttribute(ib, itemSize, byteOffset / elementBytes, normalized);

					} else {

						if (bufferView === null) {

							array = new TypedArray(accessorDef.count * itemSize);

						} else {

							array = new TypedArray(bufferView, byteOffset, accessorDef.count * itemSize);

						}

						bufferAttribute = new THREE.BufferAttribute(array, itemSize, normalized);

					}

					// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#sparse-accessors
					if (accessorDef.sparse !== undefined) {

						var itemSizeIndices = WEBGL_TYPE_SIZES.SCALAR;
						var TypedArrayIndices = WEBGL_COMPONENT_TYPES[accessorDef.sparse.indices.componentType];

						var byteOffsetIndices = accessorDef.sparse.indices.byteOffset || 0;
						var byteOffsetValues = accessorDef.sparse.values.byteOffset || 0;

						var sparseIndices = new TypedArrayIndices(bufferViews[1], byteOffsetIndices, accessorDef.sparse.count * itemSizeIndices);
						var sparseValues = new TypedArray(bufferViews[2], byteOffsetValues, accessorDef.sparse.count * itemSize);

						if (bufferView !== null) {

							// Avoid modifying the original ArrayBuffer, if the bufferView wasn't initialized with zeroes.
							bufferAttribute.setArray(bufferAttribute.array.slice());

						}

						for (var i = 0, il = sparseIndices.length; i < il; i++) {

							var index = sparseIndices[i];

							bufferAttribute.setX(index, sparseValues[i * itemSize]);
							if (itemSize >= 2) bufferAttribute.setY(index, sparseValues[i * itemSize + 1]);
							if (itemSize >= 3) bufferAttribute.setZ(index, sparseValues[i * itemSize + 2]);
							if (itemSize >= 4) bufferAttribute.setW(index, sparseValues[i * itemSize + 3]);
							if (itemSize >= 5) throw new Error('THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.');

						}

					}

					return bufferAttribute;

				});

			};

			/**
			 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#textures
			 * @param {number} textureIndex
			 * @return {Promise<THREE.Texture>}
			 */
			GLTFParser.prototype.loadTexture = function (textureIndex) {

				var parser = this;
				var json = this.json;
				var options = this.options;
				var textureLoader = this.textureLoader;

				var URL = window.URL || window.webkitURL;

				var textureDef = json.textures[textureIndex];
				var source = json.images[textureDef.source];
				var sourceURI = source.uri;
				var isObjectURL = false;

				if (source.bufferView !== undefined) {

					// Load binary image data from bufferView, if provided.

					sourceURI = parser.getDependency('bufferView', source.bufferView).then(function (bufferView) {

						isObjectURL = true;
						var blob = new Blob([bufferView], { type: source.mimeType });
						sourceURI = URL.createObjectURL(blob);
						return sourceURI;

					});

				}

				return Promise.resolve(sourceURI).then(function (sourceURI) {

					// Load Texture resource.

					var loader = THREE.Loader.Handlers.get(sourceURI) || textureLoader;

					return new Promise(function (resolve, reject) {

						loader.load(resolveURL(sourceURI, options.path), resolve, undefined, reject);

					});

				}).then(function (texture) {

					// Clean up resources and configure Texture.

					if (isObjectURL === true) {

						URL.revokeObjectURL(sourceURI);

					}

					texture.flipY = false;

					if (textureDef.name !== undefined) texture.name = textureDef.name;

					texture.format = textureDef.format !== undefined ? WEBGL_TEXTURE_FORMATS[textureDef.format] : THREE.RGBAFormat;

					if (textureDef.internalFormat !== undefined && texture.format !== WEBGL_TEXTURE_FORMATS[textureDef.internalFormat]) {

						console.warn('THREE.GLTFLoader: Three.js does not support texture internalFormat which is different from texture format. ' +
							'internalFormat will be forced to be the same value as format.');

					}

					texture.type = textureDef.type !== undefined ? WEBGL_TEXTURE_DATATYPES[textureDef.type] : THREE.UnsignedByteType;

					var samplers = json.samplers || {};
					var sampler = samplers[textureDef.sampler] || {};

					texture.magFilter = WEBGL_FILTERS[sampler.magFilter] || THREE.LinearFilter;
					texture.minFilter = WEBGL_FILTERS[sampler.minFilter] || THREE.LinearMipMapLinearFilter;
					texture.wrapS = WEBGL_WRAPPINGS[sampler.wrapS] || THREE.RepeatWrapping;
					texture.wrapT = WEBGL_WRAPPINGS[sampler.wrapT] || THREE.RepeatWrapping;

					return texture;

				});

			};

			/**
			 * Asynchronously assigns a texture to the given material parameters.
			 * @param {Object} materialParams
			 * @param {string} textureName
			 * @param {number} textureIndex
			 * @return {Promise}
			 */
			GLTFParser.prototype.assignTexture = function (materialParams, textureName, textureIndex) {

				return this.getDependency('texture', textureIndex).then(function (texture) {

					materialParams[textureName] = texture;

				});

			};

			/**
			 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#materials
			 * @param {number} materialIndex
			 * @return {Promise<THREE.Material>}
			 */
			GLTFParser.prototype.loadMaterial = function (materialIndex) {

				var parser = this;
				var json = this.json;
				var extensions = this.extensions;
				var materialDef = this.json.materials[materialIndex];

				var materialType;
				var materialParams = {};
				var materialExtensions = materialDef.extensions || {};

				var pending = [];

				if (materialExtensions[EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS]) {

					var sgExtension = extensions[EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS];
					materialType = sgExtension.getMaterialType(materialDef);
					pending.push(sgExtension.extendParams(materialParams, materialDef, parser));

				} else if (materialExtensions[EXTENSIONS.KHR_MATERIALS_UNLIT]) {

					var kmuExtension = extensions[EXTENSIONS.KHR_MATERIALS_UNLIT];
					materialType = kmuExtension.getMaterialType(materialDef);
					pending.push(kmuExtension.extendParams(materialParams, materialDef, parser));

				} else if (materialDef.pbrMetallicRoughness !== undefined) {

					// Specification:
					// https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#metallic-roughness-material

					materialType = THREE.MeshStandardMaterial;

					var metallicRoughness = materialDef.pbrMetallicRoughness;

					materialParams.color = new THREE.Color(1.0, 1.0, 1.0);
					materialParams.opacity = 1.0;

					if (Array.isArray(metallicRoughness.baseColorFactor)) {

						var array = metallicRoughness.baseColorFactor;

						materialParams.color.fromArray(array);
						materialParams.opacity = array[3];

					}

					if (metallicRoughness.baseColorTexture !== undefined) {

						pending.push(parser.assignTexture(materialParams, 'map', metallicRoughness.baseColorTexture.index));

					}

					materialParams.metalness = metallicRoughness.metallicFactor !== undefined ? metallicRoughness.metallicFactor : 1.0;
					materialParams.roughness = metallicRoughness.roughnessFactor !== undefined ? metallicRoughness.roughnessFactor : 1.0;

					if (metallicRoughness.metallicRoughnessTexture !== undefined) {

						var textureIndex = metallicRoughness.metallicRoughnessTexture.index;
						pending.push(parser.assignTexture(materialParams, 'metalnessMap', textureIndex));
						pending.push(parser.assignTexture(materialParams, 'roughnessMap', textureIndex));

					}

				} else {

					materialType = THREE.MeshPhongMaterial;

				}

				if (materialDef.doubleSided === true) {

					materialParams.side = THREE.DoubleSide;

				}

				var alphaMode = materialDef.alphaMode || ALPHA_MODES.OPAQUE;

				if (alphaMode === ALPHA_MODES.BLEND) {

					materialParams.transparent = true;

				} else {

					materialParams.transparent = false;

					if (alphaMode === ALPHA_MODES.MASK) {

						materialParams.alphaTest = materialDef.alphaCutoff !== undefined ? materialDef.alphaCutoff : 0.5;

					}

				}

				if (materialDef.normalTexture !== undefined && materialType !== THREE.MeshBasicMaterial) {

					pending.push(parser.assignTexture(materialParams, 'normalMap', materialDef.normalTexture.index));

					materialParams.normalScale = new THREE.Vector2(1, 1);

					if (materialDef.normalTexture.scale !== undefined) {

						materialParams.normalScale.set(materialDef.normalTexture.scale, materialDef.normalTexture.scale);

					}

				}

				if (materialDef.occlusionTexture !== undefined && materialType !== THREE.MeshBasicMaterial) {

					pending.push(parser.assignTexture(materialParams, 'aoMap', materialDef.occlusionTexture.index));

					if (materialDef.occlusionTexture.strength !== undefined) {

						materialParams.aoMapIntensity = materialDef.occlusionTexture.strength;

					}

				}

				if (materialDef.emissiveFactor !== undefined && materialType !== THREE.MeshBasicMaterial) {

					materialParams.emissive = new THREE.Color().fromArray(materialDef.emissiveFactor);

				}

				if (materialDef.emissiveTexture !== undefined && materialType !== THREE.MeshBasicMaterial) {

					pending.push(parser.assignTexture(materialParams, 'emissiveMap', materialDef.emissiveTexture.index));

				}

				return Promise.all(pending).then(function () {

					var material;

					if (materialType === THREE.ShaderMaterial) {

						material = extensions[EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS].createMaterial(materialParams);

					} else {

						material = new materialType(materialParams);

					}

					if (materialDef.name !== undefined) material.name = materialDef.name;

					// Normal map textures use OpenGL conventions:
					// https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#materialnormaltexture
					if (material.normalScale) {

						material.normalScale.x = - material.normalScale.x;

					}

					// emissiveTexture and baseColorTexture use sRGB encoding.
					if (material.map) material.map.encoding = THREE.sRGBEncoding;
					if (material.emissiveMap) material.emissiveMap.encoding = THREE.sRGBEncoding;

					if (materialDef.extras) material.userData = materialDef.extras;

					return material;

				});

			};

			/**
			 * @param  {THREE.BufferGeometry} geometry
			 * @param  {GLTF.Primitive} primitiveDef
			 * @param  {Array<THREE.BufferAttribute>} accessors
			 */
			function addPrimitiveAttributes(geometry, primitiveDef, accessors) {

				var attributes = primitiveDef.attributes;

				for (var gltfAttributeName in attributes) {

					var threeAttributeName = ATTRIBUTES[gltfAttributeName];
					var bufferAttribute = accessors[attributes[gltfAttributeName]];

					// Skip attributes already provided by e.g. Draco extension.
					if (!threeAttributeName) continue;
					if (threeAttributeName in geometry.attributes) continue;

					geometry.addAttribute(threeAttributeName, bufferAttribute);

				}

				if (primitiveDef.indices !== undefined && !geometry.index) {

					geometry.setIndex(accessors[primitiveDef.indices]);

				}

			}

			/**
			 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#geometry
			 * @param {Array<Object>} primitives
			 * @return {Promise<Array<THREE.BufferGeometry>>}
			 */
			GLTFParser.prototype.loadGeometries = function (primitives) {

				var parser = this;
				var extensions = this.extensions;
				var cache = this.primitiveCache;

				return this.getDependencies('accessor').then(function (accessors) {

					var geometries = [];
					var pending = [];

					for (var i = 0, il = primitives.length; i < il; i++) {

						var primitive = primitives[i];

						// See if we've already created this geometry
						var cached = getCachedGeometry(cache, primitive);

						var geometry;

						if (cached) {

							// Use the cached geometry if it exists
							pending.push(cached.then(function (geometry) {

								geometries.push(geometry);

							}));

						} else if (primitive.extensions && primitive.extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION]) {

							// Use DRACO geometry if available
							var geometryPromise = extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION]
								.decodePrimitive(primitive, parser)
								.then(function (geometry) {

									addPrimitiveAttributes(geometry, primitive, accessors);

									geometries.push(geometry);

									return geometry;

								});

							cache.push({ primitive: primitive, promise: geometryPromise });

							pending.push(geometryPromise);

						} else {

							// Otherwise create a new geometry
							geometry = new THREE.BufferGeometry();

							addPrimitiveAttributes(geometry, primitive, accessors);

							// Cache this geometry
							cache.push({

								primitive: primitive,
								promise: Promise.resolve(geometry)

							});

							geometries.push(geometry);

						}

					}

					return Promise.all(pending).then(function () {

						return geometries;

					});

				});

			};

			/**
			 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
			 * @param {number} meshIndex
			 * @return {Promise<THREE.Group|THREE.Mesh|THREE.SkinnedMesh>}
			 */
			GLTFParser.prototype.loadMesh = function (meshIndex) {

				var scope = this;
				var json = this.json;
				var extensions = this.extensions;

				var meshDef = this.json.meshes[meshIndex];

				return this.getMultiDependencies([

					'accessor',
					'material'

				]).then(function (dependencies) {

					var group = new THREE.Group();

					var primitives = meshDef.primitives;

					return scope.loadGeometries(primitives).then(function (geometries) {

						for (var i = 0, il = primitives.length; i < il; i++) {

							var primitive = primitives[i];
							var geometry = geometries[i];

							var material = primitive.material === undefined
								? createDefaultMaterial()
								: dependencies.materials[primitive.material];

							if (material.aoMap
								&& geometry.attributes.uv2 === undefined
								&& geometry.attributes.uv !== undefined) {

								console.log('THREE.GLTFLoader: Duplicating UVs to support aoMap.');
								geometry.addAttribute('uv2', new THREE.BufferAttribute(geometry.attributes.uv.array, 2));

							}

							// If the material will be modified later on, clone it now.
							var useVertexColors = geometry.attributes.color !== undefined;
							var useFlatShading = geometry.attributes.normal === undefined;
							var useSkinning = meshDef.isSkinnedMesh === true;
							var useMorphTargets = primitive.targets !== undefined;

							if (useVertexColors || useFlatShading || useSkinning || useMorphTargets) {

								if (material.isGLTFSpecularGlossinessMaterial) {

									var specGlossExtension = extensions[EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS];
									material = specGlossExtension.cloneMaterial(material);

								} else {

									material = material.clone();

								}

							}

							if (useVertexColors) {

								material.vertexColors = THREE.VertexColors;
								material.needsUpdate = true;

							}

							if (useFlatShading) {

								material.flatShading = true;

							}

							var mesh;

							if (primitive.mode === WEBGL_CONSTANTS.TRIANGLES ||
								primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP ||
								primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN ||
								primitive.mode === undefined) {

								if (useSkinning) {

									mesh = new THREE.SkinnedMesh(geometry, material);
									material.skinning = true;

								} else {

									mesh = new THREE.Mesh(geometry, material);

								}

								if (primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP) {

									mesh.drawMode = THREE.TriangleStripDrawMode;

								} else if (primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN) {

									mesh.drawMode = THREE.TriangleFanDrawMode;

								}

							} else if (primitive.mode === WEBGL_CONSTANTS.LINES ||
								primitive.mode === WEBGL_CONSTANTS.LINE_STRIP ||
								primitive.mode === WEBGL_CONSTANTS.LINE_LOOP) {

								var cacheKey = 'LineBasicMaterial:' + material.uuid;

								var lineMaterial = scope.cache.get(cacheKey);

								if (!lineMaterial) {

									lineMaterial = new THREE.LineBasicMaterial();
									THREE.Material.prototype.copy.call(lineMaterial, material);
									lineMaterial.color.copy(material.color);
									lineMaterial.lights = false;  // LineBasicMaterial doesn't support lights yet

									scope.cache.add(cacheKey, lineMaterial);

								}

								material = lineMaterial;

								if (primitive.mode === WEBGL_CONSTANTS.LINES) {

									mesh = new THREE.LineSegments(geometry, material);

								} else if (primitive.mode === WEBGL_CONSTANTS.LINE_STRIP) {

									mesh = new THREE.Line(geometry, material);

								} else {

									mesh = new THREE.LineLoop(geometry, material);

								}

							} else if (primitive.mode === WEBGL_CONSTANTS.POINTS) {

								var cacheKey = 'PointsMaterial:' + material.uuid;

								var pointsMaterial = scope.cache.get(cacheKey);

								if (!pointsMaterial) {

									pointsMaterial = new THREE.PointsMaterial();
									THREE.Material.prototype.copy.call(pointsMaterial, material);
									pointsMaterial.color.copy(material.color);
									pointsMaterial.map = material.map;
									pointsMaterial.lights = false;  // PointsMaterial doesn't support lights yet

									scope.cache.add(cacheKey, pointsMaterial);

								}

								material = pointsMaterial;

								mesh = new THREE.Points(geometry, material);

							} else {

								throw new Error('THREE.GLTFLoader: Primitive mode unsupported: ' + primitive.mode);

							}

							mesh.name = meshDef.name || ('mesh_' + meshIndex);

							if (useMorphTargets) {

								addMorphTargets(mesh, meshDef, primitive, dependencies.accessors);

							}

							if (meshDef.extras !== undefined) mesh.userData = meshDef.extras;
							if (primitive.extras !== undefined) mesh.geometry.userData = primitive.extras;

							// for Specular-Glossiness.
							if (material.isGLTFSpecularGlossinessMaterial === true) {

								mesh.onBeforeRender = extensions[EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS].refreshUniforms;

							}

							if (primitives.length > 1) {

								mesh.name += '_' + i;

								group.add(mesh);

							} else {

								return mesh;

							}

						}

						return group;

					});

				});

			};

			/**
			 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#cameras
			 * @param {number} cameraIndex
			 * @return {Promise<THREE.Camera>}
			 */
			GLTFParser.prototype.loadCamera = function (cameraIndex) {

				var camera;
				var cameraDef = this.json.cameras[cameraIndex];
				var params = cameraDef[cameraDef.type];

				if (!params) {

					console.warn('THREE.GLTFLoader: Missing camera parameters.');
					return;

				}

				if (cameraDef.type === 'perspective') {

					var aspectRatio = params.aspectRatio || 1;
					var xfov = params.yfov * aspectRatio;

					camera = new THREE.PerspectiveCamera(THREE.Math.radToDeg(xfov), aspectRatio, params.znear || 1, params.zfar || 2e6);

				} else if (cameraDef.type === 'orthographic') {

					camera = new THREE.OrthographicCamera(params.xmag / - 2, params.xmag / 2, params.ymag / 2, params.ymag / - 2, params.znear, params.zfar);

				}

				if (cameraDef.name !== undefined) camera.name = cameraDef.name;
				if (cameraDef.extras) camera.userData = cameraDef.extras;

				return Promise.resolve(camera);

			};

			/**
			 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
			 * @param {number} skinIndex
			 * @return {Promise<Object>}
			 */
			GLTFParser.prototype.loadSkin = function (skinIndex) {

				var skinDef = this.json.skins[skinIndex];

				var skinEntry = { joints: skinDef.joints };

				if (skinDef.inverseBindMatrices === undefined) {

					return Promise.resolve(skinEntry);

				}

				return this.getDependency('accessor', skinDef.inverseBindMatrices).then(function (accessor) {

					skinEntry.inverseBindMatrices = accessor;

					return skinEntry;

				});

			};

			/**
			 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
			 * @param {number} animationIndex
			 * @return {Promise<THREE.AnimationClip>}
			 */
			GLTFParser.prototype.loadAnimation = function (animationIndex) {

				var json = this.json;

				var animationDef = this.json.animations[animationIndex];

				return this.getMultiDependencies([

					'accessor',
					'node'

				]).then(function (dependencies) {

					var tracks = [];

					for (var i = 0, il = animationDef.channels.length; i < il; i++) {

						var channel = animationDef.channels[i];
						var sampler = animationDef.samplers[channel.sampler];

						if (sampler) {

							var target = channel.target;
							var name = target.node !== undefined ? target.node : target.id; // NOTE: target.id is deprecated.
							var input = animationDef.parameters !== undefined ? animationDef.parameters[sampler.input] : sampler.input;
							var output = animationDef.parameters !== undefined ? animationDef.parameters[sampler.output] : sampler.output;

							var inputAccessor = dependencies.accessors[input];
							var outputAccessor = dependencies.accessors[output];

							var node = dependencies.nodes[name];

							if (node) {

								node.updateMatrix();
								node.matrixAutoUpdate = true;

								var TypedKeyframeTrack;

								switch (PATH_PROPERTIES[target.path]) {

									case PATH_PROPERTIES.weights:

										TypedKeyframeTrack = THREE.NumberKeyframeTrack;
										break;

									case PATH_PROPERTIES.rotation:

										TypedKeyframeTrack = THREE.QuaternionKeyframeTrack;
										break;

									case PATH_PROPERTIES.position:
									case PATH_PROPERTIES.scale:
									default:

										TypedKeyframeTrack = THREE.VectorKeyframeTrack;
										break;

								}

								var targetName = node.name ? node.name : node.uuid;

								var interpolation = sampler.interpolation !== undefined ? INTERPOLATION[sampler.interpolation] : THREE.InterpolateLinear;

								var targetNames = [];

								if (PATH_PROPERTIES[target.path] === PATH_PROPERTIES.weights) {

									// node should be THREE.Group here but
									// PATH_PROPERTIES.weights(morphTargetInfluences) should be
									// the property of a mesh object under node.
									// So finding targets here.

									node.traverse(function (object) {

										if (object.isMesh === true && object.material.morphTargets === true) {

											targetNames.push(object.name ? object.name : object.uuid);

										}

									});

								} else {

									targetNames.push(targetName);

								}

								// KeyframeTrack.optimize() will modify given 'times' and 'values'
								// buffers before creating a truncated copy to keep. Because buffers may
								// be reused by other tracks, make copies here.
								for (var j = 0, jl = targetNames.length; j < jl; j++) {

									var track = new TypedKeyframeTrack(
										targetNames[j] + '.' + PATH_PROPERTIES[target.path],
										THREE.AnimationUtils.arraySlice(inputAccessor.array, 0),
										THREE.AnimationUtils.arraySlice(outputAccessor.array, 0),
										interpolation
									);

									// Here is the trick to enable custom interpolation.
									// Overrides .createInterpolant in a factory method which creates custom interpolation.
									if (sampler.interpolation === 'CUBICSPLINE') {

										track.createInterpolant = function InterpolantFactoryMethodGLTFCubicSpline(result) {

											// A CUBICSPLINE keyframe in glTF has three output values for each input value,
											// representing inTangent, splineVertex, and outTangent. As a result, track.getValueSize()
											// must be divided by three to get the interpolant's sampleSize argument.

											return new GLTFCubicSplineInterpolant(this.times, this.values, this.getValueSize() / 3, result);

										};

										// Workaround, provide an alternate way to know if the interpolant type is cubis spline to track.
										// track.getInterpolation() doesn't return valid value for custom interpolant.
										track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline = true;

									}

									tracks.push(track);

								}

							}

						}

					}

					var name = animationDef.name !== undefined ? animationDef.name : 'animation_' + animationIndex;

					return new THREE.AnimationClip(name, undefined, tracks);

				});

			};

			/**
			 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#nodes-and-hierarchy
			 * @param {number} nodeIndex
			 * @return {Promise<THREE.Object3D>}
			 */
			GLTFParser.prototype.loadNode = function (nodeIndex) {

				var json = this.json;
				var extensions = this.extensions;

				var meshReferences = this.json.meshReferences;
				var meshUses = this.json.meshUses;

				var nodeDef = this.json.nodes[nodeIndex];

				return this.getMultiDependencies([

					'mesh',
					'skin',
					'camera'

				]).then(function (dependencies) {

					var node;

					if (nodeDef.isBone === true) {

						node = new THREE.Bone();

					} else if (nodeDef.mesh !== undefined) {

						var mesh = dependencies.meshes[nodeDef.mesh];

						node = mesh.clone();

						// for Specular-Glossiness
						if (mesh.isGroup === true) {

							for (var i = 0, il = mesh.children.length; i < il; i++) {

								var child = mesh.children[i];

								if (child.material && child.material.isGLTFSpecularGlossinessMaterial === true) {

									node.children[i].onBeforeRender = child.onBeforeRender;

								}

							}

						} else {

							if (mesh.material && mesh.material.isGLTFSpecularGlossinessMaterial === true) {

								node.onBeforeRender = mesh.onBeforeRender;

							}

						}

						if (meshReferences[nodeDef.mesh] > 1) {

							node.name += '_instance_' + meshUses[nodeDef.mesh]++;

						}

					} else if (nodeDef.camera !== undefined) {

						node = dependencies.cameras[nodeDef.camera];

					} else if (nodeDef.extensions
						&& nodeDef.extensions[EXTENSIONS.KHR_LIGHTS]
						&& nodeDef.extensions[EXTENSIONS.KHR_LIGHTS].light !== undefined) {

						var lights = extensions[EXTENSIONS.KHR_LIGHTS].lights;
						node = lights[nodeDef.extensions[EXTENSIONS.KHR_LIGHTS].light];

					} else {

						node = new THREE.Object3D();

					}

					if (nodeDef.name !== undefined) {

						node.name = THREE.PropertyBinding.sanitizeNodeName(nodeDef.name);

					}

					if (nodeDef.extras) node.userData = nodeDef.extras;

					if (nodeDef.matrix !== undefined) {

						var matrix = new THREE.Matrix4();
						matrix.fromArray(nodeDef.matrix);
						node.applyMatrix(matrix);

					} else {

						if (nodeDef.translation !== undefined) {

							node.position.fromArray(nodeDef.translation);

						}

						if (nodeDef.rotation !== undefined) {

							node.quaternion.fromArray(nodeDef.rotation);

						}

						if (nodeDef.scale !== undefined) {

							node.scale.fromArray(nodeDef.scale);

						}

					}

					return node;

				});

			};

			/**
			 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#scenes
			 * @param {number} sceneIndex
			 * @return {Promise<THREE.Scene>}
			 */
			GLTFParser.prototype.loadScene = function () {

				// scene node hierachy builder

				function buildNodeHierachy(nodeId, parentObject, json, allNodes, skins) {

					var node = allNodes[nodeId];
					var nodeDef = json.nodes[nodeId];

					// build skeleton here as well

					if (nodeDef.skin !== undefined) {

						var meshes = node.isGroup === true ? node.children : [node];

						for (var i = 0, il = meshes.length; i < il; i++) {

							var mesh = meshes[i];
							var skinEntry = skins[nodeDef.skin];

							var bones = [];
							var boneInverses = [];

							for (var j = 0, jl = skinEntry.joints.length; j < jl; j++) {

								var jointId = skinEntry.joints[j];
								var jointNode = allNodes[jointId];

								if (jointNode) {

									bones.push(jointNode);

									var mat = new THREE.Matrix4();

									if (skinEntry.inverseBindMatrices !== undefined) {

										mat.fromArray(skinEntry.inverseBindMatrices.array, j * 16);

									}

									boneInverses.push(mat);

								} else {

									console.warn('THREE.GLTFLoader: Joint "%s" could not be found.', jointId);

								}

							}

							mesh.bind(new THREE.Skeleton(bones, boneInverses), mesh.matrixWorld);

						}

					}

					// build node hierachy

					parentObject.add(node);

					if (nodeDef.children) {

						var children = nodeDef.children;

						for (var i = 0, il = children.length; i < il; i++) {

							var child = children[i];
							buildNodeHierachy(child, node, json, allNodes, skins);

						}

					}

				}

				return function loadScene(sceneIndex) {

					var json = this.json;
					var extensions = this.extensions;
					var sceneDef = this.json.scenes[sceneIndex];

					return this.getMultiDependencies([

						'node',
						'skin'

					]).then(function (dependencies) {

						var scene = new THREE.Scene();
						if (sceneDef.name !== undefined) scene.name = sceneDef.name;

						if (sceneDef.extras) scene.userData = sceneDef.extras;

						var nodeIds = sceneDef.nodes || [];

						for (var i = 0, il = nodeIds.length; i < il; i++) {

							buildNodeHierachy(nodeIds[i], scene, json, dependencies.nodes, dependencies.skins);

						}

						// Ambient lighting, if present, is always attached to the scene root.
						if (sceneDef.extensions
							&& sceneDef.extensions[EXTENSIONS.KHR_LIGHTS]
							&& sceneDef.extensions[EXTENSIONS.KHR_LIGHTS].light !== undefined) {

							var lights = extensions[EXTENSIONS.KHR_LIGHTS].lights;
							scene.add(lights[sceneDef.extensions[EXTENSIONS.KHR_LIGHTS].light]);

						}

						return scene;

					});

				};

			}();

			return GLTFLoader;

		})();

		/**
		 * @author Don McCurdy / https://www.donmccurdy.com
		 */
		/* global QUnit */

		QUnit.module('Loaders', () => {

			QUnit.module('GLTFLoader', () => {

				QUnit.test('constructor', (assert) => {

					assert.ok(new THREE.GLTFLoader(), 'Can instantiate a loader.');

				});

				QUnit.test('parse - basic', (assert) => {

					var done = assert.async();

					var geometry = new THREE.BufferGeometry();
					var array = new Float32Array([
						- 1, - 1, - 1,
						1, 1, 1,
						4, 4, 4
					]);
					geometry.addAttribute('position', new THREE.BufferAttribute(array, 3));

					var meshIn = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xFF0000 }));
					meshIn.name = 'test_mesh';

					var exporter = new THREE.GLTFExporter();
					var loader = new THREE.GLTFLoader();

					exporter.parse(meshIn, function (binary) {

						loader.parse(binary, './', function (gltf) {

							var meshOut = gltf.scene.children[0];
							var attrsIn = meshIn.geometry.attributes;
							var attrsOut = meshOut.geometry.attributes;

							assert.equal(meshIn.name, meshOut.name, 'loads names');
							assert.equal(meshIn.material.color.getHex(), meshOut.material.color.getHex(), 'loads color');
							assert.smartEqual(attrsIn.position.array, attrsOut.position.array, 'loads positions');
							assert.equal(undefined, attrsOut.normal, 'ignores missing attributes');

							done();

						}, undefined, function (e) {

							console.error(e);

						});

					}, { binary: true });

				});

				QUnit.test('parse - animation', (assert) => {

					var done = assert.async();

					var node1 = new THREE.Object3D();
					node1.name = 'node1';

					var node2 = new THREE.Object3D();
					node2.name = 'node2';

					var scene = new THREE.Scene();
					scene.add(node1, node2);

					var clip = new THREE.AnimationClip('clip', undefined, [

						new THREE.VectorKeyframeTrack('node1.position', [0, 1, 2], [0, 0, 0, 30, 0, 0, 0, 0, 0])

					]);

					var exporter = new THREE.GLTFExporter();
					var loader = new THREE.GLTFLoader();

					exporter.parse(scene, function (binary) {

						loader.parse(binary, './', function (gltf) {

							var clipOut = gltf.animations[0];

							assert.equal('node1.position', clipOut.tracks[0].name, 'track name');
							assert.smartEqual(clip.tracks[0].times, clipOut.tracks[0].times, 'track times');
							assert.smartEqual(clip.tracks[0].values, clipOut.tracks[0].values, 'track values');

							done();

						}, undefined, function (e) {

							console.error(e);

						});

					}, { binary: true, animations: [clip] });

				});

			});

		});

		/**
		 * @author Mugen87 / https://github.com/Mugen87
		 * @author mrdoob / http://mrdoob.com/
		 */

		THREE.Lensflare = function () {

			THREE.Mesh.call(this, THREE.Lensflare.Geometry, new THREE.MeshBasicMaterial({ opacity: 0, transparent: true }));

			this.type = 'Lensflare';
			this.frustumCulled = false;
			this.renderOrder = Infinity;

			//

			var positionScreen = new THREE.Vector3();

			// textures

			var tempMap = new THREE.DataTexture(new Uint8Array(16 * 16 * 3), 16, 16, THREE.RGBFormat);
			tempMap.minFilter = THREE.NearestFilter;
			tempMap.magFilter = THREE.NearestFilter;
			tempMap.wrapS = THREE.ClampToEdgeWrapping;
			tempMap.wrapT = THREE.ClampToEdgeWrapping;
			tempMap.needsUpdate = true;

			var occlusionMap = new THREE.DataTexture(new Uint8Array(16 * 16 * 3), 16, 16, THREE.RGBFormat);
			occlusionMap.minFilter = THREE.NearestFilter;
			occlusionMap.magFilter = THREE.NearestFilter;
			occlusionMap.wrapS = THREE.ClampToEdgeWrapping;
			occlusionMap.wrapT = THREE.ClampToEdgeWrapping;
			occlusionMap.needsUpdate = true;

			// material

			var geometry = THREE.Lensflare.Geometry;

			var material1a = new THREE.RawShaderMaterial({
				uniforms: {
					'scale': { value: null },
					'screenPosition': { value: null }
				},
				vertexShader: [

					'precision highp float;',

					'uniform vec3 screenPosition;',
					'uniform vec2 scale;',

					'attribute vec3 position;',

					'void main() {',

					'	gl_Position = vec4( position.xy * scale + screenPosition.xy, screenPosition.z, 1.0 );',

					'}'

				].join('\n'),
				fragmentShader: [

					'precision highp float;',

					'void main() {',

					'	gl_FragColor = vec4( 1.0, 0.0, 1.0, 1.0 );',

					'}'

				].join('\n'),
				depthTest: true,
				depthWrite: false,
				transparent: false
			});

			var material1b = new THREE.RawShaderMaterial({
				uniforms: {
					'map': { value: tempMap },
					'scale': { value: null },
					'screenPosition': { value: null }
				},
				vertexShader: [

					'precision highp float;',

					'uniform vec3 screenPosition;',
					'uniform vec2 scale;',

					'attribute vec3 position;',
					'attribute vec2 uv;',

					'varying vec2 vUV;',

					'void main() {',

					'	vUV = uv;',

					'	gl_Position = vec4( position.xy * scale + screenPosition.xy, screenPosition.z, 1.0 );',

					'}'

				].join('\n'),
				fragmentShader: [

					'precision highp float;',

					'uniform sampler2D map;',

					'varying vec2 vUV;',

					'void main() {',

					'	gl_FragColor = texture2D( map, vUV );',

					'}'

				].join('\n'),
				depthTest: false,
				depthWrite: false,
				transparent: false
			});

			// the following object is used for occlusionMap generation

			var mesh1 = new THREE.Mesh(geometry, material1a);

			//

			var elements = [];

			var shader = THREE.LensflareElement.Shader;

			var material2 = new THREE.RawShaderMaterial({
				uniforms: {
					'map': { value: null },
					'occlusionMap': { value: occlusionMap },
					'color': { value: new THREE.Color(0xffffff) },
					'scale': { value: new THREE.Vector2() },
					'screenPosition': { value: new THREE.Vector3() }
				},
				vertexShader: shader.vertexShader,
				fragmentShader: shader.fragmentShader,
				blending: THREE.AdditiveBlending,
				transparent: true,
				depthWrite: false
			});

			var mesh2 = new THREE.Mesh(geometry, material2);

			this.addElement = function (element) {

				elements.push(element);

			};

			//

			var scale = new THREE.Vector2();
			var screenPositionPixels = new THREE.Vector2();
			var validArea = new THREE.Box2();
			var viewport = new THREE.Vector4();

			this.onBeforeRender = function (renderer, scene, camera) {

				viewport.copy(renderer.getCurrentViewport());

				var invAspect = viewport.w / viewport.z;
				var halfViewportWidth = viewport.z / 2.0;
				var halfViewportHeight = viewport.w / 2.0;

				var size = 16 / viewport.w;
				scale.set(size * invAspect, size);

				validArea.min.set(viewport.x, viewport.y);
				validArea.max.set(viewport.x + (viewport.z - 16), viewport.y + (viewport.w - 16));

				// calculate position in screen space

				positionScreen.setFromMatrixPosition(this.matrixWorld);

				positionScreen.applyMatrix4(camera.matrixWorldInverse);
				positionScreen.applyMatrix4(camera.projectionMatrix);

				// horizontal and vertical coordinate of the lower left corner of the pixels to copy

				screenPositionPixels.x = viewport.x + (positionScreen.x * halfViewportWidth) + halfViewportWidth - 8;
				screenPositionPixels.y = viewport.y + (positionScreen.y * halfViewportHeight) + halfViewportHeight - 8;

				// screen cull

				if (validArea.containsPoint(screenPositionPixels)) {

					// save current RGB to temp texture

					renderer.copyFramebufferToTexture(screenPositionPixels, tempMap);

					// render pink quad

					var uniforms = material1a.uniforms;
					uniforms.scale.value = scale;
					uniforms.screenPosition.value = positionScreen;

					renderer.renderBufferDirect(camera, null, geometry, material1a, mesh1, null);

					// copy result to occlusionMap

					renderer.copyFramebufferToTexture(screenPositionPixels, occlusionMap);

					// restore graphics

					var uniforms = material1b.uniforms;
					uniforms.scale.value = scale;
					uniforms.screenPosition.value = positionScreen;

					renderer.renderBufferDirect(camera, null, geometry, material1b, mesh1, null);

					// render elements

					var vecX = - positionScreen.x * 2;
					var vecY = - positionScreen.y * 2;

					for (var i = 0, l = elements.length; i < l; i++) {

						var element = elements[i];

						var uniforms = material2.uniforms;

						uniforms.color.value.copy(element.color);
						uniforms.map.value = element.texture;
						uniforms.screenPosition.value.x = positionScreen.x + vecX * element.distance;
						uniforms.screenPosition.value.y = positionScreen.y + vecY * element.distance;

						var size = element.size / viewport.w;
						var invAspect = viewport.w / viewport.z;

						uniforms.scale.value.set(size * invAspect, size);

						material2.uniformsNeedUpdate = true;

						renderer.renderBufferDirect(camera, null, geometry, material2, mesh2, null);

					}

				}

			};

			this.dispose = function () {

				material1a.dispose();
				material1b.dispose();
				material2.dispose();

				tempMap.dispose();
				occlusionMap.dispose();

				for (var i = 0, l = elements.length; i < l; i++) {

					elements[i].texture.dispose();

				}

			};

		};

		THREE.Lensflare.prototype = Object.create(THREE.Mesh.prototype);
		THREE.Lensflare.prototype.constructor = THREE.Lensflare;
		THREE.Lensflare.prototype.isLensflare = true;

		//

		THREE.LensflareElement = function (texture, size, distance, color) {

			this.texture = texture;
			this.size = size || 1;
			this.distance = distance || 0;
			this.color = color || new THREE.Color(0xffffff);

		};

		THREE.LensflareElement.Shader = {

			uniforms: {

				'map': { value: null },
				'occlusionMap': { value: null },
				'color': { value: null },
				'scale': { value: null },
				'screenPosition': { value: null }

			},

			vertexShader: [

				'precision highp float;',

				'uniform vec3 screenPosition;',
				'uniform vec2 scale;',

				'uniform sampler2D occlusionMap;',

				'attribute vec3 position;',
				'attribute vec2 uv;',

				'varying vec2 vUV;',
				'varying float vVisibility;',

				'void main() {',

				'	vUV = uv;',

				'	vec2 pos = position.xy;',

				'	vec4 visibility = texture2D( occlusionMap, vec2( 0.1, 0.1 ) );',
				'	visibility += texture2D( occlusionMap, vec2( 0.5, 0.1 ) );',
				'	visibility += texture2D( occlusionMap, vec2( 0.9, 0.1 ) );',
				'	visibility += texture2D( occlusionMap, vec2( 0.9, 0.5 ) );',
				'	visibility += texture2D( occlusionMap, vec2( 0.9, 0.9 ) );',
				'	visibility += texture2D( occlusionMap, vec2( 0.5, 0.9 ) );',
				'	visibility += texture2D( occlusionMap, vec2( 0.1, 0.9 ) );',
				'	visibility += texture2D( occlusionMap, vec2( 0.1, 0.5 ) );',
				'	visibility += texture2D( occlusionMap, vec2( 0.5, 0.5 ) );',

				'	vVisibility =        visibility.r / 9.0;',
				'	vVisibility *= 1.0 - visibility.g / 9.0;',
				'	vVisibility *=       visibility.b / 9.0;',

				'	gl_Position = vec4( ( pos * scale + screenPosition.xy ).xy, screenPosition.z, 1.0 );',

				'}'

			].join('\n'),

			fragmentShader: [

				'precision highp float;',

				'uniform sampler2D map;',
				'uniform vec3 color;',

				'varying vec2 vUV;',
				'varying float vVisibility;',

				'void main() {',

				'	vec4 texture = texture2D( map, vUV );',
				'	texture.a *= vVisibility;',
				'	gl_FragColor = texture;',
				'	gl_FragColor.rgb *= color;',

				'}'

			].join('\n')

		};

		THREE.Lensflare.Geometry = (function () {

			var geometry = new THREE.BufferGeometry();

			var float32Array = new Float32Array([
				- 1, - 1, 0, 0, 0,
				1, - 1, 0, 1, 0,
				1, 1, 0, 1, 1,
				- 1, 1, 0, 0, 1
			]);

			var interleavedBuffer = new THREE.InterleavedBuffer(float32Array, 5);

			geometry.setIndex([0, 1, 2, 0, 2, 3]);
			geometry.addAttribute('position', new THREE.InterleavedBufferAttribute(interleavedBuffer, 3, 0, false));
			geometry.addAttribute('uv', new THREE.InterleavedBufferAttribute(interleavedBuffer, 2, 3, false));

			return geometry;

		})();

		/**
		 * @author TristanVALCKE / https://github.com/Itee
		 */
		/* global QUnit */

		QUnit.module('Objects', () => {

			QUnit.module('Lensflare', () => {

				// INHERITANCE
				QUnit.todo("Extending", (assert) => {

					assert.ok(false, "everything's gonna be alright");

				});

				// INSTANCING
				QUnit.todo("Instancing", (assert) => {

					assert.ok(false, "everything's gonna be alright");

				});

			});

		});

		/**
		 * @author TristanVALCKE / https://github.com/Itee
		 */

	});

})));
