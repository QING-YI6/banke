import { useMemo } from 'react'
import * as THREE from 'three'

/** 带五片萼片和一根弯柄的番茄蒂，全部程序化建模。 */
export function StemModel() {
  const leafGeometry = useMemo(() => {
    const len = 0.62
    const w = 0.19
    const shape = new THREE.Shape()
    shape.moveTo(0, 0)
    shape.bezierCurveTo(w, len * 0.18, w * 0.82, len * 0.62, 0, len)
    shape.bezierCurveTo(-w * 0.82, len * 0.62, -w, len * 0.18, 0, 0)
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.016,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.01,
      bevelSegments: 2,
      curveSegments: 10,
    })
    geo.translate(0, 0, -0.008)
    geo.computeVertexNormals()
    return geo
  }, [])

  const stalkGeometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.02, 0),
      new THREE.Vector3(0.02, 0.14, 0.035),
      new THREE.Vector3(0.055, 0.3, 0.01),
      new THREE.Vector3(0.0, 0.46, 0.05),
    ])
    return new THREE.TubeGeometry(curve, 26, 0.038, 9, false)
  }, [])

  const leafMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#7f9452',
        roughness: 0.62,
        metalness: 0,
        clearcoat: 0.18,
        clearcoatRoughness: 0.6,
        sheen: 0.4,
        sheenColor: new THREE.Color('#b9c98a'),
        side: THREE.DoubleSide,
      }),
    [],
  )

  const stalkMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#6b7c45',
        roughness: 0.78,
        metalness: 0,
        clearcoat: 0.15,
        clearcoatRoughness: 0.7,
      }),
    [],
  )

  return (
    <group>
      {Array.from({ length: 5 }).map((_, i) => {
        const angle = (i / 5) * Math.PI * 2 + 0.35
        return (
          <group key={i} rotation={[0, angle, 0]}>
            <mesh
              geometry={leafGeometry}
              material={leafMaterial}
              rotation={[Math.PI / 2 + 0.18 + (i % 2) * 0.06, 0, 0]}
              position={[0, 0.025, 0.012]}
            />
          </group>
        )
      })}
      <mesh geometry={stalkGeometry} material={stalkMaterial} />
      <mesh position={[0, 0.015, 0]}>
        <sphereGeometry args={[0.075, 12, 10]} />
        <meshStandardMaterial color="#67783f" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.465, 0.05]}>
        <cylinderGeometry args={[0.038, 0.034, 0.012, 10]} />
        <meshStandardMaterial color="#a9b477" roughness={0.7} />
      </mesh>
    </group>
  )
}
