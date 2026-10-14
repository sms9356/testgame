#include "HaegyoCharacter.h"
#include "HaegyoInteractable.h"
#include "HaegyoGameMode.h"
#include "Camera/CameraComponent.h"
#include "Components/SpotLightComponent.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Engine/World.h"

AHaegyoCharacter::AHaegyoCharacter()
{
	PrimaryActorTick.bCanEverTick = true;
	GetCapsuleComponent()->InitCapsuleSize(32.f, 88.f);
	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(GetCapsuleComponent());
	Camera->SetRelativeLocation(FVector(0.f, 0.f, 74.f));   // 눈높이 1.62 m (캡슐 중심 기준)
	Camera->bUsePawnControlRotation = true;
	Camera->SetFieldOfView(72.f);
	Flashlight = CreateDefaultSubobject<USpotLightComponent>(TEXT("Flashlight"));
	Flashlight->SetupAttachment(Camera);
	Flashlight->SetRelativeLocation(FVector(15.f, 12.f, -8.f));
	Flashlight->SetInnerConeAngle(14.f);
	Flashlight->SetOuterConeAngle(32.f);    // 가장자리를 부드럽게 (웹 패치와 같은 방향)
	Flashlight->SetAttenuationRadius(3000.f);
	Flashlight->SetIntensity(5000.f);
	Flashlight->SetLightColor(FLinearColor(1.f, .94f, .82f));
	GetCharacterMovement()->MaxWalkSpeed = WalkSpeed;
	GetCharacterMovement()->MaxWalkSpeedCrouched = CrouchSpeed;
	GetCharacterMovement()->GetNavAgentPropertiesRef().bCanCrouch = true;
}

void AHaegyoCharacter::SetupPlayerInputComponent(UInputComponent* In)
{
	Super::SetupPlayerInputComponent(In);
	In->BindAxis("MoveForward", this, &AHaegyoCharacter::MoveForward);
	In->BindAxis("MoveRight", this, &AHaegyoCharacter::MoveRight);
	In->BindAxis("Turn", this, &APawn::AddControllerYawInput);
	In->BindAxis("LookUp", this, &APawn::AddControllerPitchInput);
	In->BindAction("Interact", IE_Pressed, this, &AHaegyoCharacter::Interact);
	In->BindAction("Flashlight", IE_Pressed, this, &AHaegyoCharacter::ToggleFlashlight);
	In->BindAction("Run", IE_Pressed, this, &AHaegyoCharacter::RunPressed);
	In->BindAction("Run", IE_Released, this, &AHaegyoCharacter::RunReleased);
	In->BindAction("Crouch", IE_Pressed, this, &AHaegyoCharacter::CrouchToggle);
	In->BindAction("Jump", IE_Pressed, this, &ACharacter::Jump);
	In->BindAction("QuickSave", IE_Pressed, this, &AHaegyoCharacter::QuickSave);
	In->BindAction("QuickLoad", IE_Pressed, this, &AHaegyoCharacter::QuickLoad);
}

void AHaegyoCharacter::MoveForward(float V) { if (V != 0.f) AddMovementInput(GetActorForwardVector(), V); }
void AHaegyoCharacter::MoveRight(float V) { if (V != 0.f) AddMovementInput(GetActorRightVector(), V); }
void AHaegyoCharacter::CrouchToggle() { bIsCrouched ? UnCrouch() : Crouch(); }

void AHaegyoCharacter::Tick(float Dt)
{
	Super::Tick(Dt);
	const bool bMoving = GetVelocity().SizeSquared2D() > 100.f;
	const bool bRun = bWantRun && bMoving && !bTired && !bIsCrouched && Stamina > 0.f;
	GetCharacterMovement()->MaxWalkSpeed = bRun ? RunSpeed : WalkSpeed;
	if (bRun) { Stamina = FMath::Max(0.f, Stamina - 18.f * Dt); if (Stamina <= 0.f) bTired = true; }
	else { Stamina = FMath::Min(100.f, Stamina + (bMoving ? 9.f : 18.f) * Dt); if (bTired && Stamina > 30.f) bTired = false; }
	if (bLightOn && Battery > 0.f) Battery = FMath::Max(0.f, Battery - BatteryDrainPerSec * Dt);
	// 배터리가 15% 아래면 부드럽게 깜빡이고, 다 떨어지면 휴대폰 불빛 정도로 약해진다
	float I = bLightOn ? 5000.f : 0.f;
	if (bLightOn && Battery < 15.f) I *= .72f + .28f * FMath::Sin(GetWorld()->TimeSeconds * 11.f) * FMath::Sin(GetWorld()->TimeSeconds * 2.7f + 1.f);
	if (bLightOn && Battery <= 0.f) I = 1600.f;
	Flashlight->SetIntensity(I);
}

void AHaegyoCharacter::ToggleFlashlight() { bLightOn = !bLightOn; }

AActor* AHaegyoCharacter::FindInteractTarget() const
{
	FHitResult Hit; FCollisionQueryParams Q(SCENE_QUERY_STAT(HaegyoInteract), false, this);
	const FVector A = Camera->GetComponentLocation(), B = A + Camera->GetForwardVector() * InteractRange;
	if (GetWorld()->LineTraceSingleByChannel(Hit, A, B, ECC_Visibility, Q) && Hit.GetActor() && Hit.GetActor()->Implements<UHaegyoInteractable>())
		return Hit.GetActor();
	return nullptr;
}

void AHaegyoCharacter::Interact()
{
	if (AActor* T = FindInteractTarget()) IHaegyoInteractable::Execute_Interact(T, this);
}

void AHaegyoCharacter::QuickSave() { if (AHaegyoGameMode* GM = GetWorld()->GetAuthGameMode<AHaegyoGameMode>()) GM->SaveGame(); }
void AHaegyoCharacter::QuickLoad() { if (AHaegyoGameMode* GM = GetWorld()->GetAuthGameMode<AHaegyoGameMode>()) GM->LoadGame(false); }
