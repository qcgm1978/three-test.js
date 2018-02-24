(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory() :
		typeof define === 'function' && define.amd ? define(factory) :
			(factory());
}(this, (function () {
	'use strict';

	QUnit.module("Source", () => {

		var REVISION = '91dev';
		var MOUSE = { LEFT: 0, MIDDLE: 1, RIGHT: 2 };
		var CullFaceNone = 0;
		var CullFaceBack = 1;
		var CullFaceFront = 2;
		var CullFaceFrontBack = 3;
		var FrontFaceDirectionCW = 0;
		var FrontFaceDirectionCCW = 1;
		var BasicShadowMap = 0;
		var PCFShadowMap = 1;
		var PCFSoftShadowMap = 2;
		var FrontSide = 0;
		var BackSide = 1;
		var DoubleSide = 2;
		var FlatShading = 1;
		var SmoothShading = 2;
		var NoColors = 0;
		var FaceColors = 1;
		var VertexColors = 2;
		var NoBlending = 0;
		var NormalBlending = 1;
		var AdditiveBlending = 2;
		var SubtractiveBlending = 3;
		var MultiplyBlending = 4;
		var CustomBlending = 5;
		var AddEquation = 100;
		var SubtractEquation = 101;
		var ReverseSubtractEquation = 102;
		var MinEquation = 103;
		var MaxEquation = 104;
		var ZeroFactor = 200;
		var OneFactor = 201;
		var SrcColorFactor = 202;
		var OneMinusSrcColorFactor = 203;
		var SrcAlphaFactor = 204;
		var OneMinusSrcAlphaFactor = 205;
		var DstAlphaFactor = 206;
		var OneMinusDstAlphaFactor = 207;
		var DstColorFactor = 208;
		var OneMinusDstColorFactor = 209;
		var SrcAlphaSaturateFactor = 210;
		var NeverDepth = 0;
		var AlwaysDepth = 1;
		var LessDepth = 2;
		var LessEqualDepth = 3;
		var EqualDepth = 4;
		var GreaterEqualDepth = 5;
		var GreaterDepth = 6;
		var NotEqualDepth = 7;
		var MultiplyOperation = 0;
		var MixOperation = 1;
		var AddOperation = 2;
		var NoToneMapping = 0;
		var LinearToneMapping = 1;
		var ReinhardToneMapping = 2;
		var Uncharted2ToneMapping = 3;
		var CineonToneMapping = 4;
		var UVMapping = 300;
		var CubeReflectionMapping = 301;
		var CubeRefractionMapping = 302;
		var EquirectangularReflectionMapping = 303;
		var EquirectangularRefractionMapping = 304;
		var SphericalReflectionMapping = 305;
		var CubeUVReflectionMapping = 306;
		var CubeUVRefractionMapping = 307;
		var RepeatWrapping = 1000;
		var ClampToEdgeWrapping = 1001;
		var MirroredRepeatWrapping = 1002;
		var NearestFilter = 1003;
		var NearestMipMapNearestFilter = 1004;
		var NearestMipMapLinearFilter = 1005;
		var LinearFilter = 1006;
		var LinearMipMapNearestFilter = 1007;
		var LinearMipMapLinearFilter = 1008;
		var UnsignedByteType = 1009;
		var ByteType = 1010;
		var ShortType = 1011;
		var UnsignedShortType = 1012;
		var IntType = 1013;
		var UnsignedIntType = 1014;
		var FloatType = 1015;
		var HalfFloatType = 1016;
		var UnsignedShort4444Type = 1017;
		var UnsignedShort5551Type = 1018;
		var UnsignedShort565Type = 1019;
		var UnsignedInt248Type = 1020;
		var AlphaFormat = 1021;
		var RGBFormat = 1022;
		var RGBAFormat = 1023;
		var LuminanceFormat = 1024;
		var LuminanceAlphaFormat = 1025;
		var RGBEFormat = RGBAFormat;
		var DepthFormat = 1026;
		var DepthStencilFormat = 1027;
		var RGB_S3TC_DXT1_Format = 33776;
		var RGBA_S3TC_DXT1_Format = 33777;
		var RGBA_S3TC_DXT3_Format = 33778;
		var RGBA_S3TC_DXT5_Format = 33779;
		var RGB_PVRTC_4BPPV1_Format = 35840;
		var RGB_PVRTC_2BPPV1_Format = 35841;
		var RGBA_PVRTC_4BPPV1_Format = 35842;
		var RGBA_PVRTC_2BPPV1_Format = 35843;
		var RGB_ETC1_Format = 36196;
		var RGBA_ASTC_4x4_Format = 37808;
		var RGBA_ASTC_5x4_Format = 37809;
		var RGBA_ASTC_5x5_Format = 37810;
		var RGBA_ASTC_6x5_Format = 37811;
		var RGBA_ASTC_6x6_Format = 37812;
		var RGBA_ASTC_8x5_Format = 37813;
		var RGBA_ASTC_8x6_Format = 37814;
		var RGBA_ASTC_8x8_Format = 37815;
		var RGBA_ASTC_10x5_Format = 37816;
		var RGBA_ASTC_10x6_Format = 37817;
		var RGBA_ASTC_10x8_Format = 37818;
		var RGBA_ASTC_10x10_Format = 37819;
		var RGBA_ASTC_12x10_Format = 37820;
		var RGBA_ASTC_12x12_Format = 37821;
		var LoopOnce = 2200;
		var LoopRepeat = 2201;
		var LoopPingPong = 2202;
		var InterpolateDiscrete = 2300;
		var InterpolateLinear = 2301;
		var InterpolateSmooth = 2302;
		var ZeroCurvatureEnding = 2400;
		var ZeroSlopeEnding = 2401;
		var WrapAroundEnding = 2402;
		var TrianglesDrawMode = 0;
		var TriangleStripDrawMode = 1;
		var TriangleFanDrawMode = 2;
		var LinearEncoding = 3000;
		var sRGBEncoding = 3001;
		var GammaEncoding = 3007;
		var RGBEEncoding = 3002;
		var LogLuvEncoding = 3003;
		var RGBM7Encoding = 3004;
		var RGBM16Encoding = 3005;
		var RGBDEncoding = 3006;
		var BasicDepthPacking = 3200;
		var RGBADepthPacking = 3201;

		/**
		 * @author TristanVALCKE / https://github.com/Itee
		 */
		/* global QUnit */

		QUnit.module('Constants', () => {

			QUnit.test("default values", (assert) => {

				assert.propEqual(MOUSE, { LEFT: 0, MIDDLE: 1, RIGHT: 2 }, 'MOUSE equal { LEFT: 0, MIDDLE: 1, RIGHT: 2 }');
				assert.equal(CullFaceNone, 0, 'CullFaceNone equal 0');
				assert.equal(CullFaceBack, 1, 'CullFaceBack equal 1');
				assert.equal(CullFaceFront, 2, 'CullFaceFront is equal to 2');
				assert.equal(CullFaceFrontBack, 3, 'CullFaceFrontBack is equal to 3');
				assert.equal(FrontFaceDirectionCW, 0, 'FrontFaceDirectionCW is equal to 0');
				assert.equal(FrontFaceDirectionCCW, 1, 'FrontFaceDirectionCCW is equal to 1');
				assert.equal(BasicShadowMap, 0, 'BasicShadowMap is equal to 0');
				assert.equal(PCFShadowMap, 1, 'PCFShadowMap is equal to 1');
				assert.equal(PCFSoftShadowMap, 2, 'PCFSoftShadowMap is equal to 2');
				assert.equal(FrontSide, 0, 'FrontSide is equal to 0');
				assert.equal(BackSide, 1, 'BackSide is equal to 1');
				assert.equal(DoubleSide, 2, 'DoubleSide is equal to 2');
				assert.equal(FlatShading, 1, 'FlatShading is equal to 1');
				assert.equal(SmoothShading, 2, 'SmoothShading is equal to 2');
				assert.equal(NoColors, 0, 'NoColors is equal to 0');
				assert.equal(FaceColors, 1, 'FaceColors is equal to 1');
				assert.equal(VertexColors, 2, 'VertexColors is equal to 2');
				assert.equal(NoBlending, 0, 'NoBlending is equal to 0');
				assert.equal(NormalBlending, 1, 'NormalBlending is equal to 1');
				assert.equal(AdditiveBlending, 2, 'AdditiveBlending is equal to 2');
				assert.equal(SubtractiveBlending, 3, 'SubtractiveBlending is equal to 3');
				assert.equal(MultiplyBlending, 4, 'MultiplyBlending is equal to 4');
				assert.equal(CustomBlending, 5, 'CustomBlending is equal to 5');
				assert.equal(AddEquation, 100, 'AddEquation is equal to 100');
				assert.equal(SubtractEquation, 101, 'SubtractEquation is equal to 101');
				assert.equal(ReverseSubtractEquation, 102, 'ReverseSubtractEquation is equal to 102');
				assert.equal(MinEquation, 103, 'MinEquation is equal to 103');
				assert.equal(MaxEquation, 104, 'MaxEquation is equal to 104');
				assert.equal(ZeroFactor, 200, 'ZeroFactor is equal to 200');
				assert.equal(OneFactor, 201, 'OneFactor is equal to 201');
				assert.equal(SrcColorFactor, 202, 'SrcColorFactor is equal to 202');
				assert.equal(OneMinusSrcColorFactor, 203, 'OneMinusSrcColorFactor is equal to 203');
				assert.equal(SrcAlphaFactor, 204, 'SrcAlphaFactor is equal to 204');
				assert.equal(OneMinusSrcAlphaFactor, 205, 'OneMinusSrcAlphaFactor is equal to 205');
				assert.equal(DstAlphaFactor, 206, 'DstAlphaFactor is equal to 206');
				assert.equal(OneMinusDstAlphaFactor, 207, 'OneMinusDstAlphaFactor is equal to 207');
				assert.equal(DstColorFactor, 208, 'DstColorFactor is equal to 208');
				assert.equal(OneMinusDstColorFactor, 209, 'OneMinusDstColorFactor is equal to 209');
				assert.equal(SrcAlphaSaturateFactor, 210, 'SrcAlphaSaturateFactor is equal to 210');
				assert.equal(NeverDepth, 0, 'NeverDepth is equal to 0');
				assert.equal(AlwaysDepth, 1, 'AlwaysDepth is equal to 1');
				assert.equal(LessDepth, 2, 'LessDepth is equal to 2');
				assert.equal(LessEqualDepth, 3, 'LessEqualDepth is equal to 3');
				assert.equal(EqualDepth, 4, 'EqualDepth is equal to 4');
				assert.equal(GreaterEqualDepth, 5, 'GreaterEqualDepth is equal to 5');
				assert.equal(GreaterDepth, 6, 'GreaterDepth is equal to 6');
				assert.equal(NotEqualDepth, 7, 'NotEqualDepth is equal to 7');
				assert.equal(MultiplyOperation, 0, 'MultiplyOperation is equal to 0');
				assert.equal(MixOperation, 1, 'MixOperation is equal to 1');
				assert.equal(AddOperation, 2, 'AddOperation is equal to 2');
				assert.equal(NoToneMapping, 0, 'NoToneMapping is equal to 0');
				assert.equal(LinearToneMapping, 1, 'LinearToneMapping is equal to 1');
				assert.equal(ReinhardToneMapping, 2, 'ReinhardToneMapping is equal to 2');
				assert.equal(Uncharted2ToneMapping, 3, 'Uncharted2ToneMapping is equal to 3');
				assert.equal(CineonToneMapping, 4, 'CineonToneMapping is equal to 4');
				assert.equal(UVMapping, 300, 'UVMapping is equal to 300');
				assert.equal(CubeReflectionMapping, 301, 'CubeReflectionMapping is equal to 301');
				assert.equal(CubeRefractionMapping, 302, 'CubeRefractionMapping is equal to 302');
				assert.equal(EquirectangularReflectionMapping, 303, 'EquirectangularReflectionMapping is equal to 303');
				assert.equal(EquirectangularRefractionMapping, 304, 'EquirectangularRefractionMapping is equal to 304');
				assert.equal(SphericalReflectionMapping, 305, 'SphericalReflectionMapping is equal to 305');
				assert.equal(CubeUVReflectionMapping, 306, 'CubeUVReflectionMapping is equal to 306');
				assert.equal(CubeUVRefractionMapping, 307, 'CubeUVRefractionMapping is equal to 307');
				assert.equal(RepeatWrapping, 1000, 'RepeatWrapping is equal to 1000');
				assert.equal(ClampToEdgeWrapping, 1001, 'ClampToEdgeWrapping is equal to 1001');
				assert.equal(MirroredRepeatWrapping, 1002, 'MirroredRepeatWrapping is equal to 1002');
				assert.equal(NearestFilter, 1003, 'NearestFilter is equal to 1003');
				assert.equal(NearestMipMapNearestFilter, 1004, 'NearestMipMapNearestFilter is equal to 1004');
				assert.equal(NearestMipMapLinearFilter, 1005, 'NearestMipMapLinearFilter is equal to 1005');
				assert.equal(LinearFilter, 1006, 'LinearFilter is equal to 1006');
				assert.equal(LinearMipMapNearestFilter, 1007, 'LinearMipMapNearestFilter is equal to 1007');
				assert.equal(LinearMipMapLinearFilter, 1008, 'LinearMipMapLinearFilter is equal to 1008');
				assert.equal(UnsignedByteType, 1009, 'UnsignedByteType is equal to 1009');
				assert.equal(ByteType, 1010, 'ByteType is equal to 1010');
				assert.equal(ShortType, 1011, 'ShortType is equal to 1011');
				assert.equal(UnsignedShortType, 1012, 'UnsignedShortType is equal to 1012');
				assert.equal(IntType, 1013, 'IntType is equal to 1013');
				assert.equal(UnsignedIntType, 1014, 'UnsignedIntType is equal to 1014');
				assert.equal(FloatType, 1015, 'FloatType is equal to 1015');
				assert.equal(HalfFloatType, 1016, 'HalfFloatType is equal to 1016');
				assert.equal(UnsignedShort4444Type, 1017, 'UnsignedShort4444Type is equal to 1017');
				assert.equal(UnsignedShort5551Type, 1018, 'UnsignedShort5551Type is equal to 1018');
				assert.equal(UnsignedShort565Type, 1019, 'UnsignedShort565Type is equal to 1019');
				assert.equal(UnsignedInt248Type, 1020, 'UnsignedInt248Type is equal to 1020');
				assert.equal(AlphaFormat, 1021, 'AlphaFormat is equal to 1021');
				assert.equal(RGBFormat, 1022, 'RGBFormat is equal to 1022');
				assert.equal(RGBAFormat, 1023, 'RGBAFormat is equal to 1023');
				assert.equal(LuminanceFormat, 1024, 'LuminanceFormat is equal to 1024');
				assert.equal(LuminanceAlphaFormat, 1025, 'LuminanceAlphaFormat is equal to 1025');
				assert.equal(RGBEFormat, RGBAFormat, 'RGBEFormat is equal to RGBAFormat');
				assert.equal(DepthFormat, 1026, 'DepthFormat is equal to 1026');
				assert.equal(DepthStencilFormat, 1027, 'DepthStencilFormat is equal to 1027');
				assert.equal(RGB_S3TC_DXT1_Format, 33776, 'RGB_S3TC_DXT1_Format is equal to 33776');
				assert.equal(RGBA_S3TC_DXT1_Format, 33777, 'RGBA_S3TC_DXT1_Format is equal to 33777');
				assert.equal(RGBA_S3TC_DXT3_Format, 33778, 'RGBA_S3TC_DXT3_Format is equal to 33778');
				assert.equal(RGBA_S3TC_DXT5_Format, 33779, 'RGBA_S3TC_DXT5_Format is equal to 33779');
				assert.equal(RGB_PVRTC_4BPPV1_Format, 35840, 'RGB_PVRTC_4BPPV1_Format is equal to 35840');
				assert.equal(RGB_PVRTC_2BPPV1_Format, 35841, 'RGB_PVRTC_2BPPV1_Format is equal to 35841');
				assert.equal(RGBA_PVRTC_4BPPV1_Format, 35842, 'RGBA_PVRTC_4BPPV1_Format is equal to 35842');
				assert.equal(RGBA_PVRTC_2BPPV1_Format, 35843, 'RGBA_PVRTC_2BPPV1_Format is equal to 35843');
				assert.equal(RGB_ETC1_Format, 36196, 'RGB_ETC1_Format is equal to 36196');
				assert.equal(RGBA_ASTC_4x4_Format, 37808, "Constants.RGBA_ASTC_4x4_Format is equal to 37808");
				assert.equal(RGBA_ASTC_5x4_Format, 37809, "Constants.RGBA_ASTC_5x4_Format is equal to 37809");
				assert.equal(RGBA_ASTC_5x5_Format, 37810, "Constants.RGBA_ASTC_5x5_Format is equal to 37810");
				assert.equal(RGBA_ASTC_6x5_Format, 37811, "Constants.RGBA_ASTC_6x5_Format is equal to 37811");
				assert.equal(RGBA_ASTC_6x6_Format, 37812, "Constants.RGBA_ASTC_6x6_Format is equal to 37812");
				assert.equal(RGBA_ASTC_8x5_Format, 37813, "Constants.RGBA_ASTC_8x5_Format is equal to 37813");
				assert.equal(RGBA_ASTC_8x6_Format, 37814, "Constants.RGBA_ASTC_8x6_Format is equal to 37814");
				assert.equal(RGBA_ASTC_8x8_Format, 37815, "Constants.RGBA_ASTC_8x8_Format is equal to 37815");
				assert.equal(RGBA_ASTC_10x5_Format, 37816, "Constants.RGBA_ASTC_10x5_Format is equal to 37816");
				assert.equal(RGBA_ASTC_10x6_Format, 37817, "Constants.RGBA_ASTC_10x6_Format is equal to 37817");
				assert.equal(RGBA_ASTC_10x8_Format, 37818, "Constants.RGBA_ASTC_10x8_Format is equal to 37818");
				assert.equal(RGBA_ASTC_10x10_Format, 37819, "Constants.RGBA_ASTC_10x10_Format is equal to 37819");
				assert.equal(RGBA_ASTC_12x10_Format, 37820, "Constants.RGBA_ASTC_12x10_Format is equal to 37820");
				assert.equal(RGBA_ASTC_12x12_Format, 37821, "Constants.RGBA_ASTC_12x12_Format is equal to 37821");
				assert.equal(LoopOnce, 2200, 'LoopOnce is equal to 2200');
				assert.equal(LoopRepeat, 2201, 'LoopRepeat is equal to 2201');
				assert.equal(LoopPingPong, 2202, 'LoopPingPong is equal to 2202');
				assert.equal(InterpolateDiscrete, 2300, 'InterpolateDiscrete is equal to 2300');
				assert.equal(InterpolateLinear, 2301, 'InterpolateLinear is equal to 2301');
				assert.equal(InterpolateSmooth, 2302, 'InterpolateSmooth is equal to 2302');
				assert.equal(ZeroCurvatureEnding, 2400, 'ZeroCurvatureEnding is equal to 2400');
				assert.equal(ZeroSlopeEnding, 2401, 'ZeroSlopeEnding is equal to 2401');
				assert.equal(WrapAroundEnding, 2402, 'WrapAroundEnding is equal to 2402');
				assert.equal(TrianglesDrawMode, 0, 'TrianglesDrawMode is equal to 0');
				assert.equal(TriangleStripDrawMode, 1, 'TriangleStripDrawMode is equal to 1');
				assert.equal(TriangleFanDrawMode, 2, 'TriangleFanDrawMode is equal to 2');
				assert.equal(LinearEncoding, 3000, 'LinearEncoding is equal to 3000');
				assert.equal(sRGBEncoding, 3001, 'sRGBEncoding is equal to 3001');
				assert.equal(GammaEncoding, 3007, 'GammaEncoding is equal to 3007');
				assert.equal(RGBEEncoding, 3002, 'RGBEEncoding is equal to 3002');
				assert.equal(LogLuvEncoding, 3003, 'LogLuvEncoding is equal to 3003');
				assert.equal(RGBM7Encoding, 3004, 'RGBM7Encoding is equal to 3004');
				assert.equal(RGBM16Encoding, 3005, 'RGBM16Encoding is equal to 3005');
				assert.equal(RGBDEncoding, 3006, 'RGBDEncoding is equal to 3006');
				assert.equal(BasicDepthPacking, 3200, 'BasicDepthPacking is equal to 3200');
				assert.equal(RGBADepthPacking, 3201, 'RGBADepthPacking is equal to 3201');

			});

		});



	});

})));
